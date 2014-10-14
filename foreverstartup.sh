#!/bin/bash
#check if already started
forever list | grep ppplz-server.js > /dev/null
if [ $? -ne 0 ]; then
	#start forever daemon
	forever start ppplz-server.js
fi
