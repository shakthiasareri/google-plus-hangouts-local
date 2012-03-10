/// <reference path="helpers/jquery-vsdoc.js" />
/// <reference path="helpers/json2.min.js" />
/// <reference path="helpers/hangout.js" />

var App = {

	DEBUG: false,

	start: function () {

		// Clear everything if we're in debug
		if (App.DEBUG) {
			gapi.hangout.data.clearValue("message");
		}


		var EWrap = $("#UI"),
			EParticipants = $("#participants", EWrap),
			EMessage = $("#message", EWrap),
			EForm = $("form", EWrap),
			ENewMessage = $("#new-message", EForm),
			EUpdate = $("#update", EWrap);


		function updateParticipants() {
			EParticipants.empty();
			$.each(gapi.hangout.getParticipants(), function (index, participant) {
				EParticipants.append('<li>' + participant.person.displayName + '</li>');
			});
		}

		function updateMessage() {
			$.each(gapi.hangout.data.getState(), function (stateKey, stateValue) {
				if (stateKey == "message") {
					EMessage.text(stateValue);
				}
			})
		}

		gapi.hangout.onParticipantsChanged.add(function (evt) {
			updateParticipants();
		});

		gapi.hangout.data.onStateChanged.add(function (evt) {
			updateMessage();
		});

		EForm.on("submit", function (e) {
			e.preventDefault();
			gapi.hangout.data.setValue("message", ENewMessage.val());
			ENewMessage.val("").focus();
		});


		updateParticipants();
		updateMessage();


	}

}