<?php
    $headers = 'MIME-Version: 1.0' . "\r\n" .
            'Content-type: text/html; charset=iso-8859-1' ."\r\n" .
            'From: ' .$email . "\r\n" .
            'Reply-To: gis@raleighnc.gov' . "\r\n" .
            'X-Mailer: PHP/' .phpversion();

    $email = "";
    $message = "";
    if (isset($_REQUEST['email'])) {
    	$email = $_REQUEST['email'];
    } else {
    	exit("email address required");
    }

    if (isset($_REQUEST['message'])) {
    	$message = $_REQUEST['message'];
    } else {
    	exit("message required");
    }


    mail("gis@raleighnc.gov", "Adopt-A-Shelter Feedback", $message, $headers);
?>