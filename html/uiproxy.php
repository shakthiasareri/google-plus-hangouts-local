<?php

$filename = "ui.html";

$uiFile = fopen($filename,"r");
	
$ui = fread($uiFile , filesize($filename));
	
fclose($uiFile);


echo $_GET['callback'] . '("'.base64_encode(preg_replace("/\s+/", " ", $ui)).'")';


?>