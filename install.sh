#!/bin/sh
#
# let's prompt for admin credentials now, if necessary
sudo -v || exit
member=`sudo groupmems -g games -l | grep -c nobody`
[ $member -eq 0 ] && sudo groupmems -g games -a nobody
member=`sudo groupmems -g games -l | grep -c $USER`
[ $member -eq 0 ] && sudo groupmems -g games -a $USER

[ -n "$1" ] && TARGET="$1" || TARGET=/usr/local/games
[ -d "${TARGET}" ] || sudo mkdir -v "${TARGET}"
TARGET="${TARGET}/`basename ${PWD}`"
echo "Installing into ${TARGET}"
[ -d "${TARGET}" ] || sudo mkdir -v "${TARGET}"
[ -d "${TARGET}/users" ] || sudo mkdir -v "${TARGET}/users"

# let's start with the services
[ -n "`which node-gyp`" ] || sudo dnf install node-gyp nodejs-typescript
[ -n "`which resize`" ] || sudo dnf install xterm-resize

# this.package install script
npm install

# transpile
npm run build

# copy over
sudo cp ./node_modules/animate.css/animate.min.css ./build/door/static
sudo rsync -a --delete ./build/ "${TARGET}"
sudo rsync -a --delete ./node_modules "${TARGET}/"
sudo chown -R root.games "${TARGET}"
sudo find "${TARGET}" -type d -exec chmod u+rwx,g+rwxs,o-rwx {} \;

# initialize the game
cd "${TARGET}"
env REMOTEHOST=localhost ./logins.sh
sudo chmod 660 "${TARGET}/users/*"

echo -e "\n${PWD}"
ls -lh "${TARGET}"

# practical, but use at your own risk
[ -n "`which in.telnetd`" ] || sudo dnf install telnet-server

cat > dankdomain << EOD
# default: on
# description: Dank Domain TTY service allows for remote user logins to play
#              Return of Hack & Slash.
service dankdomain
{
        disable         = no
        port            = 23
        socket_type     = stream
        type            = UNLISTED
        wait            = no
        umask           = 117
        user            = nobody
        group           = games
        server          = `which in.telnetd`
        server_args     = -h -i -N -L ${TARGET}/tty.sh
#       server_args     = -h -N -L ${TARGET}/logins.sh
        env             = TERM=linux
        cps             = 2 5
        log_on_success  += HOST
        log_on_failure  =
        instances       = 2
        per_source      = 1
}
EOD

sudo mv -v dankdomain /etc/xinetd.d/
sudo systemctl enable xinetd
sudo systemctl restart xinetd
echo -e "\nOld school gaming door added:\n$ telnet localhost\n"

if sudo service iptables status ; then
	hole=`sudo iptables -L INPUT -n | grep -c 'dpt:23'`
	if [ $hole -eq 0 ]; then
        sudo iptables -A INPUT -p tcp --syn --dport 23 -m connlimit --connlimit-above 1 -j REJECT
        sudo iptables -A INPUT -p tcp -m state --state NEW -m tcp --dport 23 -j ACCEPT
        sudo service iptables save
	fi
else
    firewall-cmd --permanent --direct --add-rule ipv4 nat OUTPUT 0 -p tcp -o lo --dport 443 -j REDIRECT --to-ports 1939
fi

sudo cp -v "${TARGET}/etc/dankdomain-door.service" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable dankdomain-door
#sudo systemctl start dankdomain-door
sudo systemctl status dankdomain-door -l

echo -n "Press RETURN to continue for Apache DOOR instructions: "
read n

echo
echo ... an Apache configuration example follows:
echo

cat <<-EOD
DOOR uses app: express + ws fronts node-pty
   for client: browser uses xterm and bundle.js

if https / wss is used, SSL Proxy works for me like this:

#
#   Apache proxy to run local Node.js apps
#
    SSLProxyEngine On
    SSLProxyCheckPeerName off
    SSLProxyVerify none
    ProxyRequests Off
    ProxyBadHeader Ignore
    <Proxy *>
        Order deny,allow
        Allow from all
    </Proxy>

    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} WebSocket [NC]
    RewriteRule "^/xterm/door/(.*)" wss://localhost:1939/xterm/door/$1 [P,L]

    <Location "/xterm/door/">
        RequestHeader set X-Forwarded-Proto "https"
        ProxyPass "https://localhost:1939/xterm/door/"
        ProxyPassReverse "https://localhost:1939/xterm/door/"
        ProxyPreserveHost On
        Order allow,deny
        Allow from all
        Header edit Location ^https://localhost:1939/xterm/door/ https://robert.hurst-ri.us/xterm/door/
    </Location>

# generate a self-signed key
$ openssl req -newkey rsa:2048 -nodes -keyout key.pem -x509 -days 365 -out cert.pem \
    -subj "/C=US/ST=Rhode Island/L=Providence/O=Dank Domain/OU=Game/CN=localhost"
EOD
exit
