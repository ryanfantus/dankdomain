#!/bin/sh -l

path=`dirname $0`; cd $path || exit 1
export HOME=$PWD/door
umask 0002
eval `resize 2> /dev/null | grep LINES`
[ -n "$LINES" ] || export LINES=25

exec node telnet localhost 1939 $LINES
