#!/bin/bash
#check if already started
forever list | grep ppplz-server.js > /dev/null
if [ $? -ne 0 ]; then
	#start forever daemon
	forever start -a -l $(pwd)/logs/foreverlog.txt ppplz-server.js
fi
