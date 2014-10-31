var //Requires
	osuppplz = require('osu-ppplz'),
	ppplzFormat = require('ppplz-format'),
	osuirc = require('osu-sic-irc'),
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
	delink = function (str) {
		return str.replace(/\[.+? (.+?)\]/g, '$1');
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
	formatWatching = function (watching) {
		var outstr = '';
		if (watching.length === 0) {
			return color('Nobody', 7) + color(' is using !watch right now.', 3);
		} else if (watching.length === 1) {
			return color(linkUser(watching[0]), 7) + color(' is using !watch right now.', 3);
		} else if (watching.length <= 10) {
			return watching.slice(0, -1).map(function (userName) {
				return color(linkUser(userName), 7);
			}).join(color(', ', 3)) + color((watching.length === 2 ? '' : ',') + ' and ', 3) + linkUser(watching.slice(-1)[0]) + color(' are using !watch right now.', 3);
		} else {
			return watching.slice(0, 10).map(function (userName) {
				return color(linkUser(userName), 7);
			}).join(color(', ', 3)) + color(', ... (', 3) + color(watching.length + ' people', 7) + color(') are using !watch right now.', 3);
		}
	},
	linkUser = function (name) {
		return '[http://osu.ppy.sh/u/' + name + ' ' + name + ']';
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
			ppplz = osuppplz(key),
			onlineStatus = 'offline',
			onlineMsg = 'Playing some osu! :D',
			currentStatus,
			onlineTimeout = null,
			timeoutStatus = function () {
				var args = Array.prototype.slice.call(arguments),
					newStatus = args.shift();
				if (onlineStatus !== newStatus) {
					onlineStatus = newStatus;
					log(time(), color(user, 7) + color('\'s Status is now "' + onlineStatus + '"', 3));
				}
				if (onlineTimeout) {
					clearTimeout(onlineTimeout);
				}
				if (args.length > 0) {
					onlineTimeout = setTimeout(function () {
						timeoutStatus.apply(undefined, args);
					}, 1000 * 60 * 15);
				}
			},
			refreshOnline = function (newStatus) {
				newStatus = newStatus || currentStatus || 'online';
				currentStatus = newStatus;
				timeoutStatus(newStatus, 'away', 'offline');
			};
		irc.on('ready', function () {
			log(time(), color('Connected to Bancho.', 3));
		});
		irc.on('nosuchnick', function (nick) {
			log(time(), color('Error: "' + nick + '" is already offline.', 1));
			ppplz.unwatch(nick);
		});
		irc.on('end', function () {
			log(time(), color('Error: SIC process terminated.', 1));
		});
		irc.on('respawned', function () {
			log(time(), color('SIC process respawned.', 3));
		});
		irc.on('message', function (msg) {
			var format,
				msgparts = msg.message.split(' '),
				mode,
				modeName,
				watching,
				userName,
				filter = '';
			msgparts[1] = msgparts[1] || '';
			msgparts[2] = msgparts[2] || '';
			if (msgparts[0].slice(0, 1) === '!') {
				if (msg.from === user) {
					refreshOnline();
				}
				switch (msgparts[0].toLowerCase()) {
					case '!ppplz':
					case '!pp':
						log(time(), color('!ppplz command received from ', 3) + color(msg.from, 7));
						if (msgparts[1] && msgparts[1].toLowerCase() === 'user' && msgparts[2] && msg.from === user) {
							userName = msgparts[2];
							msgparts.splice(1, 2);
						} else {
							userName = msg.from;
						}
						switch ((msgparts[1] || '').toLowerCase()) {
							case 'osu':
							case 'osu!':
								mode = ppplz.Modes.osu;
								break;
							case 'taiko':
								mode = ppplz.Modes.taiko;
								break;
							case 'ctb':
								mode = ppplz.Modes.CtB;
								break;
							case 'osumania':
							case 'osu!mania':
								mode = ppplz.Modes.osumania;
								break;
							case '':
								mode = ppplz.Modes.osu;
								break;
							default:
								mode = ppplz.Modes.osu;
								irc.send(userName, 'Invalid gamemode name');
								log(time(), fromUser(userName), 'Invalid gamemode name');
						}
						format = ppplzFormat(ppplz, {
							color: true,
							filter: 'tries',
							link: true
						}, function (str) {
							irc.send(userName, decolor(str));
							log(time(), fromUser(userName), delink(str));
						});
						ppplz.lastScore(msg.from, mode, format);
						break;
					case '!watch':
					case '!w':
						log(time(), color('!watch command received from ', 3) + color(msg.from, 7));
						if (msgparts[1] && msgparts[1].toLowerCase() === 'user' && msgparts[2] && msg.from === user) {
							userName = msgparts[2];
							msgparts.splice(1, 2);
						} else {
							userName = msg.from;
						}
						switch ((msgparts[1] || '').toLowerCase()) {
							case 'tries':
								filter = 'tries';
								msgparts[1] = msgparts[2];
								break;
							case 'plays':
								msgparts[1] = msgparts[2];
								break;
							case 'pbs':
								filter = 'pbs';
								msgparts[1] = msgparts[2];
								break;
						}
						switch ((msgparts[1] || '').toLowerCase()) {
							case 'osu':
							case 'osu!':
								mode = ppplz.Modes.osu;
								modeName = 'osu!';
								break;
							case 'taiko':
								mode = ppplz.Modes.taiko;
								modeName = 'Taiko!';
								break;
							case 'ctb':
								mode = ppplz.Modes.CtB;
								modeName = 'CtB';
								break;
							case 'osumania':
							case 'osu!mania':
								mode = ppplz.Modes.osumania;
								modeName = 'osu!mania';
								break;
							case '':
								mode = ppplz.Modes.osu;
								modeName = 'osu!';
								break;
							default:
								mode = ppplz.Modes.osu;
								modeName = 'osu!';
								irc.send(userName, 'Invalid gamemode name');
								log(time(), fromUser(userName), 'Invalid gamemode name');
						}
						format = ppplzFormat(ppplz, {
							color: true,
							filter: filter,
							link: true
						}, function (str) {
							irc.send(userName, decolor(str));
							log(time(), fromUser(userName), delink(str));
						});
						if (ppplz.watching(msg.from)) {
							irc.send(userName, 'Error, already watching.');
							log(time(), fromUser(userName), color('Error, already watching', 1));
						} else {
							ppplz.watch(userName, mode, function () {
								if (msg.from === user) {
									refreshOnline();
								}
								format.apply(undefined, arguments);
							});
							irc.send(userName, 'Watching. Waiting for ' + modeName + ' plays...');
							log(time(), fromUser(userName), color('Watching. Waiting for ' + modeName + ' plays...', 3));
						}
						break;
					case '!unwatch':
					case '!uw':
						log(time(), color('!unwatch command received from ', 3) + color(msg.from, 7));
						if (msgparts[1].toLowerCase() === 'all' && msg.from === user) {
							ppplz.unwatch();
							irc.send(msg.from, 'Will stop watching everybody...');
							log(time(), fromUser(msg.from), color('Will stop watching everybody...', 3));
						} else if (msgparts[1].toLowerCase() === 'user' && msgparts[2] && msg.from === user) {
							ppplz.unwatch(msgparts[2]);
							irc.send(msg.from, 'Will stop watching ' + msgparts[2] + '...');
							log(time(), fromUser(msg.from), color('Will stop watching ', 3) + color(msgparts[2], 7) + color('...', 3));
						} else {
							ppplz.unwatch(msg.from);
							irc.send(msg.from, 'Will stop watching...');
							log(time(), fromUser(msg.from), color('Will stop watching...', 3));
						}
						break;
					case '!watching':
						watching = ppplz.watching();
						log(time(), color('!watching command received from ', 3) + color(msg.from, 7));
						if (msgparts[1].toLowerCase() === 'names' && msg.from === user) {
							watching = formatWatching(watching);
							irc.send(msg.from, decolor(watching));
							log(time(), fromUser(msg.from), delink(watching));
						} else {
							irc.send(msg.from, watching.length + ' people are using !watch right now.');
							log(time(), fromUser(msg.from), color(watching.length, 7) + color(' people are using !watch right now.', 3));
						}
						break;
					case '!status':
					case '!s':
						log(time(), color('!status command received from ', 3) + color(msg.from, 7));
						if (msgparts[1].toLowerCase() === 'set' && msgparts[2] && msg.from === user) {
							switch (msgparts[2]) {
								case 'offline':
									timeoutStatus('offline');
									break;
								case 'away':
									timeoutStatus('away', 'offline');
									break;
								default:
									refreshOnline(msgparts[2]);
							}
							if (msgparts[3]) {
								onlineMsg = msgparts.slice(3).join(' ');
							}
							irc.send(msg.from, 'Status set to "' + onlineStatus + '", Message set to "' + onlineMsg + '"');
							log(time(), fromUser(msg.from), color('Status set to "', 3) + color(onlineStatus, 7) + color('", Message set to "', 3) + color(onlineMsg, 7) + color('"', 3));
						} else if (msgparts[1].toLowerCase() === 'get' && msg.from === user) {
							irc.send(msg.from, 'Status is "' + onlineStatus + '", Message is "' + onlineMsg + '"');
							log(time(), fromUser(msg.from), color('Status is "', 3) + color(onlineStatus, 7) + color('", Message is "', 3) + color(onlineMsg, 7) + color('"', 3));
						} else {
							if (onlineStatus === 'away') {
								irc.send(msg.from, 'I\'m online, real ' + user + ' is too, but he is probably doing some other Stuff.' + onlineStatus + ': ' + onlineMsg);
								log(time(), fromUser(msg.from), color('I\'m online, real ', 3) + color(user, 7) + color(' is too, but he is probably doing some other Stuff. ', 3) + color(onlineStatus, 7) + color(': ', 3) + color(onlineMsg, 7));
							} else if (onlineStatus === 'offline') {
								irc.send(msg.from, 'I\'m online, but my non-robot version is not. If you want to talk, check back later.');
								log(time(), fromUser(msg.from), color('I\'m online, but my non-robot version is not. If you want to talk, check back later.', 3));
							} else {
								irc.send(msg.from, 'I\'m online, real ' + user + ' is too. ' + onlineStatus + ': ' + onlineMsg);
								log(time(), fromUser(msg.from), color('I\'m online, real ', 3) + color(user, 7) + color(' is too. ', 3) + color(onlineStatus, 7) + color(': ', 3) + color(onlineMsg, 7));
							}
						}
						break;
					case '!help':
					case '!h':
						log(time(), color('!help command received from ', 3) + color(msg.from, 7));
						irc.send(msg.from, 'Need help? The official doc page of this bot is [http://ferdi265.github.io/project/osu/ppplz/2014/09/26/osu-ppplz-bot-back-up.html here].');
						log(time(), fromUser(msg.from), color('Need help? The official doc page of this bot is ', 3) + color('here', 7) + color('.', 3));
						break;
					default:
						log(time(), color('invalid command received from ', 3) + color(msg.from, 7));
						irc.send(msg.from, 'Invalid command. See !help.');
						log(time(), fromUser(msg.from), color('Invalid command. See !help.', 3));
						break;
				}
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