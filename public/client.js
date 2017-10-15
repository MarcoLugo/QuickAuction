var socket = io();

//////////////////////////////////////////////////////////////////////////
//Document ready (DOM loaded)
//////////////////////////////////////////////////////////////////////////

$(document).ready(function(){
    var $usernameField = $('.inputUsername');
    var $bidField = $('.inputBid');
    var $loginDiv = $('.loginContainer'); 
    var $auctionDiv = $('.auctionContainer');
    var $messageList = $('.bidList');
    var $winningBid = $('.winningBid');
    
    $usernameField.focus(); //Put cursor on username input field on page load
    
    function usernameSubmitted(){
        username = $usernameField.val().trim();

        if(username.length > 0){
            socket.emit('newClient', username);
            $loginDiv.fadeOut();
            $auctionDiv.show();
            $bidField.focus();
        }
    }
    
    function bidSubmitted(){
        bid = $bidField.val().trim();

        if(bid.length > 0){
            socket.emit('newMsg', bid);
            $bidField.val('');
        }
    }
    
    function sendNotification(message, type, delay) {
        if($loginDiv.is(":visible")) return; //User has not logged in yet, ignore notification request
        if(delay === undefined) delay = 1100;
        $.notify({ message: message },{ type: type, delay: delay });
    }
    
    function updateWinningBid(text){ //Pulsate once
        $winningBid.fadeTo('fast', 0.3, function(){
            $winningBid.text(text.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '$'); //Format the number to use comma as thousands separator
            $winningBid.fadeTo('fast', 1);
        });
    }
    
    function addMessage(data){
        var bidAnnouncement = ' : ';
        
        if(data.exception === false){
            updateWinningBid(data.msg); 
            bidAnnouncement = (data.msg.match(/[^$,.\d]/)) ? '' : ' bids / offre: ';
        }
        var $newBidLi = '<li class="bidDisplay"><b>' + data.username + '</b>' + bidAnnouncement + data.msg + '</li>';
        $messageList.prepend($newBidLi);
    }
    
    function loginSetup(loginData) { //User arrived after the start, let's recreate the bid history
		for(i in loginData.bidHistory){
			addMessage({
				username: loginData.bidHistory[i][2],
				msg: loginData.bidHistory[i][3],
                exception: loginData.bidHistory[i][4]
			});
		}
	}
    
//////////////////////////////////////////////////////////////////////////
//Keyboard and Click Event handling
//////////////////////////////////////////////////////////////////////////

    //Listen for ENTER key event on the input fields
    $usernameField.on('keypress', function(e){
        if(e.keyCode == 13) usernameSubmitted();
    });
    $bidField.on('keypress', function(e){
        if(e.keyCode == 13) bidSubmitted();
    });
    $loginDiv.on('click', function(){
        $usernameField.focus(); //Bring the focus back to the input field for the username
    });


//////////////////////////////////////////////////////////////////////////
//Socket.io Event handling
//////////////////////////////////////////////////////////////////////////

    socket.on('disconnect', function () {
        sendNotification('You have been disconnected / Vous avez été déconnecté(e)', 'warning');
    });
      
    socket.on('notHighEnough', function(){
        sendNotification('The bid must be higher that the current leader / Vous devez offrir plus que le meneur actuel', 'warning', 2000);
    });
      
    socket.on('bidRejected', function(){
        sendNotification('The bid must be numerical (e.g. 150) / Veuillez entrer des numéros (e.g. 150)', 'warning', 2000);
    });

    socket.on('newClientAll', function (data) {
        sendNotification(data.username + " joined / s'est connecté(e)", 'info');
    });
      
    socket.on('loginData', function (data) {
        loginSetup(data);
    });

    socket.on('addMsg', function(data){
        addMessage(data);
    });
    
    
});