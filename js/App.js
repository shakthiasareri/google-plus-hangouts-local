/// <reference path="helpers/jquery-vsdoc.js" />
/// <reference path="helpers/json2.min.js" />
/// <reference path="helpers/hangout.js" />

var App = {

	DEBUG_HANGOUT: false,

	start: function () {

		if (App.DEBUG_HANGOUT) {

			console.warn('Debug hangout enabled. This will print all the internals of Google+ Hangouts API, and give you commands to query the API');
			console.log('-- Press ALT + SHIFT + F1 to toggle the command overlay --');

			/*
			Participants
			*/

			function inspectParticipantsEvent(eventName, participants) {

				console.groupCollapsed('Event:', eventName);

				$.each(participants, function (participantIndex, participant) {
					console.group('participant');
					console.log('displayIndex', participant.displayIndex);
					console.log('hasAppEnabled', participant.hasAppEnabled);
					console.log('hasCamera', participant.hasCamera);
					console.log('hasMicrophone', participant.hasMicrophone);
					console.log('id', participant.id);
					// Person
					console.group('participant.person');
					console.log('displayName', participant.person.displayName);
					console.log('id', participant.person.id);
					// Image
					console.groupCollapsed('participant.person.image');
					console.log('url', participant.person.image.url);
					console.groupEnd();
					console.groupEnd();
					console.groupEnd();
				});

				console.groupEnd();
			}

			// onParticipantsAdded
			// https://developers.google.com/+/hangouts/reference#gapi.hangout.onParticipantsAdded
			gapi.hangout.onParticipantsAdded.add(function (evt) {
				inspectParticipantsEvent('onParticipantsAdded', evt.addedParticipants);
			});

			// onParticipantsChanged
			// https://developers.google.com/+/hangouts/reference#gapi.hangout.onParticipantsChanged
			gapi.hangout.onParticipantsChanged.add(function (evt) {
				inspectParticipantsEvent('onParticipantsChanged', evt.participants);
			});

			// onParticipantsDisabled
			// https://developers.google.com/+/hangouts/reference#gapi.hangout.onParticipantsDisabled
			gapi.hangout.onParticipantsDisabled.add(function (evt) {
				inspectParticipantsEvent('onParticipantsDisabled', evt.disabledParticipants);
			});

			// onParticipantsEnabled
			// https://developers.google.com/+/hangouts/reference#gapi.hangout.onParticipantsEnabled
			gapi.hangout.onParticipantsEnabled.add(function (evt) {
				inspectParticipantsEvent('onParticipantsEnabled', evt.enabledParticipants);
			});

			// onParticipantsRemoved
			// https://developers.google.com/+/hangouts/reference#gapi.hangout.onParticipantsRemoved
			gapi.hangout.onParticipantsRemoved.add(function (evt) {
				inspectParticipantsEvent('onParticipantsRemoved', evt.removedParticipants);
			});


			/*
			Data
			*/

			// onStateChanged
			// https://developers.google.com/+/hangouts/reference#gapi.hangout.data.onStateChanged
			gapi.hangout.data.onStateChanged.add(function (evt) {
				console.group('Event: onStateChanged');
				if (evt.addedKeys.length > 0) {
					console.group('Added keys');
					$.each(evt.addedKeys, function (key, val) {
						$.each(val, function (mKey, mVal) {
							console.log(mKey, mVal);
						});
					});
					console.groupEnd();
				}
				if (evt.removedKeys.length > 0) {
					console.group('Added keys');
					$.each(evt.removedKeys, function (key, val) {
						$.each(val, function (mKey, mVal) {
							console.log(mKey, mVal);
						});
					});
					console.groupEnd();
				}
				console.group('State');
				$.each(evt.state, function (key, val) {
					console.log(key, val);
				});
				console.groupEnd();

				console.group('Metadata');
				$.each(evt.metadata, function (key, val) {
					console.group(val.key);
					$.each(val, function (mKey, mVal) {
						console.log(mKey, mVal);
					});
					console.groupEnd();
				});
				console.groupEnd();


				console.groupEnd();
			});

			/*
			Commands
			*/

			// uses keycodes
			var CMD = {
				'gapi.hangout': [
					{
						name: 'getEnabledParticipants()',
						description: 'Gets the participants who have enabled the app.',
						returns: 'Array.<gapi.hangout.Participant>',
						method: function () {
							inspectParticipantsEvent('getEnabledParticipants', gapi.hangout.getEnabledParticipants());
						}
					}, {
						name: 'getHangoutUrl()',
						description: 'Gets the URL for the hangout.',
						returns: 'string',
						method: function () {
							console.log(gapi.hangout.getHangoutUrl());
						}
					}, {
						name: 'getHangoutId()',
						description: 'Gets an identifier for the hangout guaranteed to be unique for the hangout\'s duration. The API makes no other guarantees about this identifier.',
						returns: 'string',
						method: function () {
							console.log(gapi.hangout.getHangoutId());
						}
					}, {
						name: 'getLocale()',
						description: 'Gets the locale for the participant in the hangout.',
						returns: 'string',
						method: function () {
							console.log(gapi.hangout.getLocale());
						}
					}, {
						name: 'getParticipantById(participantId:string)',
						description: 'Gets the participant with the given id. Returns null if no participant exists with the given id.',
						returns: 'gapi.hangout.Participant',
						method: function () {
							var id = prompt("participantId:string");
							if (id) {
								inspectParticipantsEvent('getParticipantById', [gapi.hangout.getParticipantById(id)]);
							} else {
								console.log(undefined);
							}
						}
					}, {
						name: 'getParticipantId()',
						description: 'Gets the id of the local participant. A user is assigned a new id each time they join a hangout.',
						returns: 'string',
						method: function () {
							console.log(gapi.hangout.getParticipantId());
						}
					}, {
						name: 'getParticipants()',
						description: 'Gets the participants in the hangout. Note that the list of participants reflects the current state on the hangouts server. There may be a small window of time where the local participant (returned from getParticipantId()) is not in the returned array.',
						returns: 'Array.<gapi.hangout.Participant>',
						method: function () {
							inspectParticipantsEvent('getParticipants', gapi.hangout.getParticipants());
						}
					}, {
						name: 'hideApp()',
						description: 'Hide the app and show the video feed in the main hangout window. The app will continue to run while it is hidden.',
						returns: 'undefined',
						method: function () {
							gapi.hangout.hideApp();
							console.log(undefined);
						}
					}, {
						name: 'isApiReady()',
						returns: 'boolean',
						description: 'Returns true if the gapi.hangout API is initialized; false otherwise. Before the API is initialized, data values may have unexpected values.',
						method: function () {
							console.log(gapi.hangout.isApiReady());
						}
					}, {
						name: 'isAppVisible()',
						returns: 'boolean',
						description: 'Returns true if the app is visible in the main hangout window, false otherwise.',
						method: function () {
							console.log(gapi.hangout.isAppVisible());
						}
					}
				],
				'gapi.hangout.data': [
					{
						name: 'clearValue(key:string)',
						description: 'Clears a single key/value pair.',
						returns: 'undefined',
						method: function () {
							var key = prompt("key");
							if (key) {
								gapi.hangout.data.clearValue(key);
							}
							console.assert(gapi.hangout.data.getValue(key) == null);
							console.log(undefined);
						}
					}, {
						name: 'getKeys()',
						description: 'Gets the keys in the shared state object, an array of strings.',
						returns: 'Array.<string>',
						method: function () {
							$.each(gapi.hangout.data.getKeys(), function (keyIndex, key) {
								console.log(key);
							});
						}
					}, {
						name: 'getState()',
						description: 'Gets the shared state object, a set of name/value pairs.',
						returns: 'Object.<string, string>',
						method: function () {
							$.each(gapi.hangout.data.getState(), function (key, val) {
								console.log(key, val);
							});
						}
					}, {
						name: 'getStateMetadata()',
						description: 'Gets the state metadata object, which contains the same key/value data as the shared state object retrieved via getState but augmented with additional information.',
						returns: 'Object.<string, Object>',
						method: function () {
							$.each(gapi.hangout.data.getStateMetadata(), function (key, val) {
								console.group(val.key);
								$.each(val, function (mKey, mVal) {
									console.log(mKey, mVal);
								});
								console.groupEnd();
							});
						}
					}, {
						name: 'setValue(key:string, value:string)',
						description: 'Sets a single key value pair.',
						returns: 'undefined',
						method: function () {
							var key = prompt("key:string,");
							var value = prompt("value:string");
							if (key && value) {
								gapi.hangout.data.setValue(key, value);
							}
							console.log(undefined);
						}
					}, {
						name: 'submitDelta(opt_updates:Object.<string, string>, opt_removes:Array.<string>)',
						description: 'Submits a request to update the value of the shared state object.',
						returns: 'undefined',
						method: function () {
							var opt_updates = prompt("opt_updates:Object.<string, string>");
							var opt_removes = prompt("opt_removes:Array.<string>");
							if (opt_updates && opt_removes) {
								gapi.hangout.data.submitDelta(opt_updates, opt_removes);
							}
							console.log(undefined);
						}
					}
				]
			};

			var EDebugBar = $('<div />').css(
			{
				position: "absolute",
				top: "0",
				left: "0",
				background: "#cccccc",
				fontSize: "12px",
				fontFamily: "courier new !important",
				padding: "5px",
				lineHeight: "160%",
				display: "none",
				opacity: "0.9",
				width: "700px"
			});

			$.each(CMD, function (namespace, functions) {

				EDebugNamespace = $('<div />');

				EDebugNamespace.text(namespace);

				$.each(functions, function (key, val) {

					var EDebugFunction = $('<a style="color: blue !important; display: block; margin: 0 15px;" href="#" title="' + val.description + '" />');
					EDebugFunction.on("mouseover", function () {
						$(this).css('color', 'purple !important');
					}).on("mouseout", function () {
						$(this).css('color', 'blue !important');
					});

					EDebugFunction.text(val.name + ":" + val.returns);
					EDebugFunction.on("click", function (e) {
						e.preventDefault();
						console.group('Command:', val.name);
						val.method();
						console.groupEnd();
					});

					EDebugNamespace.append(EDebugFunction);

				});


				EDebugBar.append(EDebugNamespace);

			});

			EDebugBar.css('left', (($("body").width() - EDebugBar.width()) / 2) + 'px');

			$("body").append(EDebugBar);

			window.onkeyup = function (e) {
				if (e.altKey == 1 && e.shiftKey == 1 && e.keyCode == "112") {
					EDebugBar.toggle();
				}
			};

		}








		/*
		Demo
		*/


		var EWrap = $("#UI"),
			EParticipants = $("#participants", EWrap),
			EMessage = $("#message", EWrap),
			EForm = $("form", EWrap),
			ENewMessage = $("#new-message", EForm),
			EUpdate = $("#update", EWrap);


		function updateParticipants() {

			console.log('updateParticipants');

			EParticipants.empty();
			$.each(gapi.hangout.getParticipants(), function (index, participant) {
				EParticipants.append('<li><img src="' + participant.person.image.url + '" height="25" style="vertical-align: middle;" /> ' + participant.person.displayName + '</li>');
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