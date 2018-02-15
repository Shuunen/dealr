## by default, script is executed in directory where it is called
## so... call this shell script like :
# sh /home/YOU/Projects/musitop/shortcuts/musinext.sh

HERE=$(dirname $0)
date > $HERE/app.log
node app.js >> app.log

# whereis node >> $HERE/app.log
## if node is not find maybe you'll need to make it globally available :
# whereis node
## should give you this : "/hey/a/path/to/node"
## else run :
# sudo ln -s /hey/a/path/to/node /usr/bin/node

