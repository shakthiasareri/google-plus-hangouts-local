/// <reference path="App.js" />

$(function () {

	$.get("html/ui.html", function (data) {

		// sorry IE
		var range = document.createRange();
		range.selectNode(document.body);
		var documentFragment = range.createContextualFragment(data);
		document.head.appendChild(documentFragment.querySelectorAll("style")[0]);
		document.body.appendChild(documentFragment.querySelectorAll("#UI")[0]);

		App.DEBUG = true;
		App.start();
	});

});