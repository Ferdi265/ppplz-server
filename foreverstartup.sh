#!/bin/bash
forever list | grep ppplz-server.js > /dev/null
if [ $? -ne 0 ]; then
	forever start ppplz-server.js
fi
