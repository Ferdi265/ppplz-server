#!/bin/bash
cd $(dirname $0)
forever start -a -l $(pwd)/logs/foreverlog.txt ppplz-server.js --no-log
