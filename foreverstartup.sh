#!/bin/bash
cd $(dirname $0)
forever start -a -l $(dirname $0)/logs/foreverlog.txt ppplz-server.js
