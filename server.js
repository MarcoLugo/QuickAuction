/*
Title: QuickAuction
Author: Marco Lugo
Version 0.02 - October 21st, 2017

Quick and simple to use program to run auction. You just need to launch it on
a given port and give the address and port to auction participants. Please note
that the current version does not authenticate users and allows for multiple users
from a single IP. It was made with charity fundraisers in mind. A future version
may include these features.

To run on port 8080, use: node server.js 8080

Sessions can be restored by adding the log filename as an additional parameter, for example:
    node server.js 8080 auction-history-1508092469415-8080.txt
    
Users, presumably the admin, can send plain-text messages as bids by preceeding the message
in the bid input field with x00. A bid such as "x005 minutes left!" would be shown all 
participants as "5 minutes left!".

Version 0.02 adds XSS prevention for the username as well.
*/

var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var fs = require('fs');

app.use(express.static(__dirname + '/public'));

var port = process.argv[2]; //1st argument is port

//Create log file for bids that can be used for logging purposes but also for loading an interrupted session
initTime = new Date().getTime();
fs.writeFile('auction-history-'+initTime+'-'+port+'.txt', '', function (err) { if (err) throw err; });

//Launch the server and bind to user-defined port
server.listen(port, function(){ console.log('Auction server open on port: ' + port); });

//////////////////////////////////////////////////////////////////////////
//Database arrays
//////////////////////////////////////////////////////////////////////////
var msgDatabase = [];
var bidDatabase = [0];

/*
A 3rd argument can be passed when launching the app, allowing a session to be restored.
The argument must be the exact filename of the session's log file.
*/
if(process.argv[3] !== undefined) restoreSession(process.argv[3]);


//////////////////////////////////////////////////////////////////////////
//Event handling
//////////////////////////////////////////////////////////////////////////

var nClients = 0;

io.on('connection', function(socket){
  var isNewUser = true;
  var clientIp = socket.request.headers['x-forwarded-for'] || socket.request.connection.remoteAddress; //Attempt to get client's IP for logging purposes; only tested on LAN
  socket.emit('loginData', { bidHistory: msgDatabase }); //Send session data to new client, allows 'late arrival' to auction
		
  //Event: newMsg
  socket.on('newMsg', function(data){
    switch(isMsgAcceptable(data)){
        case 'yes':
            timestamp = new Date().getTime();
            isException = (data.indexOf('x00') == 0) ? true : false;
            message = cleanMsg(data); //Clean the message
            username = cleanUsername(socket.username); //Apply XSS prevention to the username
            io.emit('addMsg', { username: username, msg: message, exception: isException }); //Send bid (or message) to everyone
        
            //Save message, bid and write to log file
            msgDatabase.push([timestamp, clientIp, username, message, isException]);
            if(isException === false) bidDatabase.push(parseFloat(data));
            fs.appendFile('auction-history-'+initTime+'-'+port+'.txt', timestamp+'§'+clientIp+'§'+username+'§'+message+'\r\n', function(err){ if(err) throw err; });
            break;
        case 'notHighEnough':  socket.emit('notHighEnough');  break; //Tell client that the bid was not high enough
        default:  socket.emit('bidRejected'); //Tell client that the bid was not in right format
	}
  });

  //Event: newClient
  socket.on('newClient', function(username){
    if(isNewUser === false) return; //Nothing to do; client already logged in

    isNewUser = false;
    socket.username = username;
    nClients++;
	
    socket.broadcast.emit('newClientAll', { //emit newClientAll to everyone (broadcast) except sender
      username: socket.username,
      nClients: nClients
    });
  });

  //Event: disconnect
  socket.on('disconnect', function(){
    if(isNewUser === false){
      nClients--;
      socket.broadcast.emit('clientDisconnected', {
        username: socket.username,
        nClients: nClients
      });
    }
  });
  
});


//////////////////////////////////////////////////////////////////////////
//Helper functions
//////////////////////////////////////////////////////////////////////////

/* 
This function does QA on the message. Only numerical messages
will be allowed to pass. The numerical message (bid) is only allowed if the bid
is higher than all previous bids.
One exception applies: messages preceeded by x00 will go through. This is helpful
in case a text message needs to be broadcasted by whoever is operating the auction.
*/
function isMsgAcceptable(msg){
    if(msg.indexOf('x00') == 0) return 'yes'; //Exception code used, show the message
    if(msg.match(/[^$,.\d]/)) return 'no'; //not numeric
    if(parseFloat(msg) <= Math.max.apply(null, bidDatabase)) return 'notHighEnough'; //Bid must be higher than all previous
    return 'yes';
}

function preventXSS(string){
    string = string.replace(/</g, '&lt'); //To avoid the most common XSS attacks, otherwise injection would be possible with x00<script>alert('I am XSS');</script> for bid or direction injection with username, for example
    string = string.replace(/>/g, '&gt'); //Idem
    return string;
}

function cleanMsg(msg){
    msg = msg.replace('x00', '');
    msg = msg.replace(',', '.');
    msg = msg.replace('$', '');
    msg = preventXSS(msg);
    return msg;
}

function cleanUsername(username){
    username = preventXSS(username);
    return username;
}

function restoreSession(fromTextFile){
    fs.readFile(fromTextFile, 'utf8', function(err, data){
        if (err) throw err;
        fileLines = data.split('\r\n');
        for(line in fileLines){
            fields = fileLines[line].split('§');
            if(fields.length < 4) continue;
            msgDatabase.push([fields[0], fields[1], fields[2], fields[3]]);
            bidDatabase.push(parseFloat(fields[3]));
        }
        console.log('Restored session ' + fromTextFile + ':');
        console.log(msgDatabase);
    });
}