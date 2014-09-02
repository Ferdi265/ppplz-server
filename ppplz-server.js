var //Requires
	osuppplz = require('osu-ppplz'),
	ppplzFormat = require('ppplz-format'),
	osuirc = require('osu-irc'),
	fs = require('fs'),
	argv = require('optimist').argv,
	Color = require('colorful').Color,
	//Functions
	color = function (string, fg, bg) {
		var c = new Color(string);
		c.fgcolor = fg === undefined ? null : fg;
		c.bgcolor = bg === undefined ? null : bg;
		return '' + c;
	},
	decolor = function (str) {
		return str.replace(/\u001b\[3\dm/g, '').replace(/\u001b\[0m/g, '');
	},
	padleft = function (num, digits) {
		return Array(digits -num.toFixed(0).length + 1).join('0') + String(num);
	},
	time = function () {
		var now = new Date();
		return color('[' + padleft(now.getHours(), 2) + ':' + padleft(now.getMinutes(), 2) + ']', 6);
	},
	fromUser = function (username) {
		return color('for ', 3) + color(username, 7) + color(':', 3);
	},
	log = function () {
		var args = Array.prototype.slice.call(arguments),
			str = args.join(' ');
		if (logfile) logfile.write(decolor(str) + '\r\n');
		console.log(str);
	},
	read = function (callback) {
		process.stdin.once('data', function (data) {
			if (data !== null) {
				process.stdin.pause();
				callback((data + '').replace(/\r?\n$/, ''));
			}
		});
		process.stdin.resume();
	},
	prompt = function (u, k, p) {
		var user = function () {
				if (!u) {
					process.stdout.write(color('Username: ', 3));
					read(function (username) {
						log(color('Username set to ', 3) + color(username, 7));
						key(username);
					});
				} else {
					key(u);
				}
			},
			key = function (username) {
				if (!k) {
					process.stdout.write(color('Api key: ', 3));
					read(function (apikey) {
						log(color('Api key set to ', 3) + color(apikey, 7));
						passwd(username, apikey);
					});
				} else {
					passwd(username, k);
				}
			},
			passwd = function (username, apikey) {
				if (!p) {
					process.stdout.write(color('IRC password: ', 3));
					read(function (ircpassword) {
						log(color('IRC password set to ', 3) + color(ircpassword, 7));
						start(username, apikey, ircpassword);
					});
				} else {
					start(username, apikey, p);
				}
			},
			start = function (username, apikey, ircpassword) {
				fs.writeFile('./cfg.json', JSON.stringify({
					username: username,
					apikey: apikey,
					ircpassword: ircpassword
				}, null, '\t'));
				init(username, apikey, ircpassword);
			};
		user();
	},
	init = function (user, key, passwd) {
		var irc = osuirc(user, passwd),
			ppplz = osuppplz(key);
		irc.on('ready', function () {
			log(time(), color('Connected to Bancho.', 3));
		});
		irc.on('message', function (msg) {
			var format,
				msgparts = msg.message.split(' '),
				mode,
				modeName;
			if (msgparts[0] === '!ppplz' || msgparts[0] === '!pp') {
				log(time(), color('!ppplz command received from ', 3) + color(msg.from, 7));
				if (msgparts[1] === 'osu' === msgparts[1] === 'osu!') {
					mode = ppplz.Modes.osu;
				} else if (msgparts[1] === 'taiko' || msgparts[1] === 'Taiko') {
					mode = ppplz.Modes.taiko;
				} else if (msgparts[1] === 'ctb' || msgparts[1] === 'CtB') {
					mode = ppplz.Modes.CtB;
				} else if (msgparts[1] === 'osumania' || msgparts[1] === 'osu!mania') {
					mode = ppplz.Modes.osumania;
				} else {
					mode = ppplz.Modes.osu;
				}
				format = ppplzFormat(ppplz, {
					color: true
				}, function (str) {
					irc.send(msg.from, decolor(str));
					log(time(), fromUser(msg.from), str);
				});
				ppplz.lastScore(msg.from, mode, format.score);
			} else if (msgparts[0] === '!watch' || msgparts[0] === '!w') {
				log(time(), color('!watch command received from ', 3) + color(msg.from, 7));
				if (msgparts[1] === 'osu' === msgparts[1] === 'osu!') {
					mode = ppplz.Modes.osu;
					modeName = 'osu!';
				} else if (msgparts[1] === 'taiko' || msgparts[1] === 'Taiko') {
					mode = ppplz.Modes.taiko;
					modeName = 'Taiko';
				} else if (msgparts[1] === 'ctb' || msgparts[1] === 'CtB') {
					mode = ppplz.Modes.CtB;
					modeName = 'CtB';
				} else if (msgparts[1] === 'osumania' || msgparts[1] === 'osu!mania') {
					mode = ppplz.Modes.osumania;
					modeName = 'osu!mania';
				} else {
					mode = ppplz.Modes.osu;
					modeName = 'osu!';
				}
				format = ppplzFormat(ppplz, {
					color: true
				}, function (str) {
					irc.send(msg.from, decolor(str));
					log(time(), fromUser(msg.from), str);
				});
				ppplz.watch(msg.from, mode, format.watch);
				irc.send(msg.from, 'Watching. Waiting for ' + modeName + ' plays...');
				log(time(), fromUser(msg.from), color('Watching. Waiting for ' + modeName + ' plays...', 3));
			} else if (msgparts[0] === '!unwatch' || msgparts[0] === '!uw') {
				log(time(), color('!unwatch command received from ', 3) + color(msg.from, 7));
				ppplz.unwatch(msg.from);
				irc.send(msg.from, 'Will stop watching...');
				log(time(), fromUser(msg.from), color('Will stop watching...', 3));
			}
		});
	},
	//Variables
	logfile;

if (argv['clear-log']) {
logfile = fs.createWriteStream('./log.txt', {
	flags: 'w'
});
} else if (!argv['no-log']) {
	logfile = fs.createWriteStream('./log.txt', {
		flags: 'a'
	});
}
if (typeof argv.u !== 'string') {
	argv.u = undefined;
}
if (typeof argv.p !== 'string') {
	argv.p = undefined;
}
if (typeof argv.k !== 'string') {
	argv.k = undefined;
}
fs.exists('./cfg.json', function (exists) {
	if (exists) {
		fs.readFile('./cfg.json', function (err, jsonString) {
			var cfg;
			if (err) {
				log(time(), color('Could not open ./cfg.json', 1));
				log(time(), color('' + err, 1));
			}
			try {
				cfg = JSON.parse(jsonString);
				prompt(argv.u || cfg.username, argv.k || cfg.apikey, argv.p || cfg.ircpassword);
			} catch (e) {
				log(time(), color('Configuration file invalid!', 1));
				log(time(), color('' + e, 1));
				prompt(argv.u, argv.k, argv.p);
			}
		});
	} else {
		prompt(argv.u, argv.k, argv.p);
	}
});