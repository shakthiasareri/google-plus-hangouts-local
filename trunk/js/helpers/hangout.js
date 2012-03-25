/// <reference path="jquery-vsdoc.js" />

var PARTICIPANT = null,
	NAME = "googleplushangoutslocal",
	UPDATE_RATE = 100,
	TIMEOUT = 4;



this.gapi = new function () {

	this.hangout = new function () {


		/*
		Helpers
		*/

		var Storage = new function () {

			function getNestedObjectProperty(o, s) {
				s = s.replace(/\[(\w+)\]/g, '.$1');
				s = s.replace(/^\./, '');
				var a = s.split('.');
				while (a.length) {
					var n = a.shift();
					if (n in o) {
						o = o[n];
					} else {
						return;
					}
				}
				return o;
			}

			function updateNestedObjectProperty(obj, keyStr, value) {
				var keyPath = keyStr.split('.');
				var lastKeyIndex = keyPath.length - 1;
				for (var i = 0; i < lastKeyIndex; ++i) {
					key = keyPath[i];
					if (!(key in obj))
						obj[key] = {}
					obj = obj[key];
				}
				obj[keyPath[lastKeyIndex]] = value;
			}

			if (!localStorage[NAME] || typeof localStorage[NAME] == 'undefined') {
				localStorage[NAME] = JSON.stringify({});
			}

			this.set = function (key, val) {
				var localData = JSON.parse(localStorage[NAME]);
				updateNestedObjectProperty(localData, key, val);
				localStorage[NAME] = JSON.stringify(localData);
			};

			this.get = function (key, defaultObject) {
				var localData = JSON.parse(localStorage.getItem(NAME));
				if (key) {
					var ret = getNestedObjectProperty(localData, key);
					return ret || defaultObject;
				}
				return localData;
			};

			this.reset = function (newModel) {
				//localStorage[NAME] = JSON.stringify(newModel);
				localStorage.clear();
			};

		}

		function makeIdHelper_(num) {
			var chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz",
				str = "";
			for (var i = 0; i < num; i++) {
				var rnum = Math.floor(Math.random() * chars.length);
				str += chars.substring(rnum, rnum + 1);
			}
			return str;
		}

		function newTimestamp() {
			return Math.round(new Date().getTime() / 1000.0);
		}

		function getTimestamps() {
			return Storage.get("timestamps", {});
		}

		function getUserDeltaTimestamps() {
			return Storage.get("userDeltaTimestamps", {})
		}

		// Debug hook

		$(function () {
			$("body").bind("DebugBarAdded", function (evt, EDebugBar) {

				var functions = [{
					name: 'reset()',
					description: 'Clear all local data',
					returns: 'undefined',
					method: function () {
						Storage.reset();
						window.location.reload();
					}
				}];

				var EDebugNamespace = $('<div />');
				EDebugNamespace.text("local");
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

				$(EDebugBar).append(EDebugNamespace);

			});
		});



		/*****************************************************\
		*
		* gapi.hangout
		*
		\*****************************************************/


		/*
		Private
		*/

		var participants_ = addedParticipants_ = removedParticipants_ = disabledParticipants_ = [],
			apiReady_ = appVisible_ = true;


		/*
		Classes
		*/

		// TODO: https://developers.google.com/+/api/latest/people#resource
		this.Person = function() { }

		this.Participant = function(id, hasMicrophone, hasCamera, hasAppEnabled, personId, personDisplayName, personImgUrl) {
			/// <summary>
			///		A Participant instance represents a person who has joined a Google hangout. Hangout participant fields should not be modified.
			///		&#10; - Each Participant has a person field which is similar to a subset of Google+ API person. You can get a list of all participants using getParticipants.
			///		&#10; - A Participant instance might not contain all of the fields described below the only fields that a participant is guaranteed to contain are hangoutId and hasAppInstalled.
			/// </summary>
			/// <param name="id" type="string">
			///		A string uniquely identifying this participant in the hangout. It is not suitable for display to the user.
			///		&#10; - Each time a user joins a hangout, they are assigned a new participant ID. This ID is used to identify a participant throughout the API.
			///	</param>
			/// <param name="displayIndex" type="number">
			///		True if the participant has a microphone installed.
			///	</param>
			/// <param name="hasMicrophone" type="boolean">
			///		The index of the participant on the filmstrip, 0-based. Can be null.
			///	</param>
			/// <param name="hasCamera" type="boolean">
			///		True if the participant has a video camera installed.
			///	</param>
			/// <param name="hasAppEnabled" type="boolean">
			///		True if the participant has this app enabled and running in this hangout.
			///	</param>
			/// <param name="person" type="Person">
			///		The representation of the participant's Google+ person.
			///		&#10; - This field and its sub-fields are not present if the participant has not enabled the app.
			///	</param>

			this.id = id;
			this.displayIndex = undefined;
			this.hasMicrophone = hasMicrophone;
			this.hasCamera = hasCamera;
			this.hasAppEnabled = hasAppEnabled;
			this.person = {
				id: personId,
				displayName: personDisplayName,
				image: {
					url: personImgUrl
				}
			};
		}

		var ApiReadyEvent = function () {
			/// <summary>Contains information relating to the API becoming ready.</summary>
			/// <returns type="boolean">Indicates whether the API is ready.</returns>
			this.isApiReady = apiReady_;
		}

		var AppVisibleEvent = function () {
			/// <summary>Provides information about an AppVisible event.</summary>
			/// <returns type="boolean">Indicates whether the app is visible.</returns>
			this.isAppVisible = appVisible_;
		}

		var EnabledParticipantsChangedEvent = function () {
			/// <summary>Provides information about an EnabledParticipantsChanged event.</summary>
			/// <returns type="Array.&lt;gapi.hangout.Participant&gt;">List of all participants with the app enabled.</returns>
			this.enabledParticipants = this.getEnabledParticipants();
		}

		var ParticipantsAddedEvent = function () {
			/// <summary>Provides information about a ParticipantsAdded event.</summary>
			/// <returns type="Array.&lt;gapi.hangout.Participant&gt;">List of the newly added participants.</returns>
			this.addedParticipants = addedParticipants_;
		}

		var ParticipantsChangedEvent = function () {
			/// <summary>Provides information about a ParticipantsChanged event.</summary>
			/// <returns type="Array.&lt;gapi.hangout.Participant&gt;">List of the participants currently in the hangout.</returns>
			this.participants = participants_;
		}

		var ParticipantsDisabledEvent = function () {
			/// <summary>Contains information relating to newly disabled participants.</summary>
			/// <returns type="Array.&lt;gapi.hangout.Participant&gt;">List of the newly disabled participants.</returns>
			this.disabledParticipants = disabledParticipants_;
		}

		var ParticipantsEnabledEvent = function () {
			/// <summary>Contains information relating to newly enabled participants.</summary>
			/// <returns type="Array.&lt;gapi.hangout.Participant&gt;">List of the newly enabled participants.</returns>
			this.enabledParticipants = this.getEnabledParticipants();
		}

		var ParticipantsRemovedEvent = function () {
			/// <summary>Provides information about a ParticipantsRemoved event.</summary>
			/// <returns type="Array.&lt;gapi.hangout.Participant&gt;">List of the participants who have left the hangout.</returns>
			this.removedParticipants = removedParticipants_;
		}

		/*
		Functions
		*/

		this.getEnabledParticipants = function () {
			/// <summary>Gets the participants who have enabled the app.</summary>
			/// <returns type="Array.&lt;gapi.hangout.Participant&gt;"></returns>
			var retVal = [];
			$.each(participants_, function (participantIndex, participant) {
				if (participant.hasAppEnabled) {
					retVal.push(participant);
				}
			});
			return retVal;
		}

		this.getHangoutUrl = function () {
			/// <summary>Gets the URL for the hangout.</summary>
			/// <example>https://hangoutsapi.talkgadget.google.com/hangouts/1b8d9e10742f576bc994e18866ea</example>
			/// <returns type="string"></returns>
			return "localhost";
		}

		this.getHangoutId = function () {
			/// <summary>Gets an identifier for the hangout guaranteed to be unique for the hangout's duration. The API makes no other guarantees about this identifier.</summary>
			/// <example>muvc-private-chat-99999a93-6273-390d-894a-473226328d79@groupchat.google.com</example>
			/// <returns type="string"></returns>
			return "muvc-private-chat-" + makeIdHelper_(10) + "@localhost";
		}

		this.getLocale = function () {
			/// <summary>Gets the locale for the participant in the hangout.</summary>
			/// <example>Example: 'en-US'</example>
			/// <returns type="string"></returns>
			return window.navigator.language;
		}

		this.getParticipantById = function (participantId) {
			/// <summary>Gets the participant with the given id. Returns null if no participant exists with the given id.</summary>
			/// <param name="participantId" type="string"></param>
			/// <returns type="gapi.hangout.Participant"></returns>
			$.each(participants_, function (participantIndex, participant) {
				if (participant.id == participantId) {
					return participant;
				}
			});
			return null;
		}

		this.getParticipantId = function () {
			/// <summary>Gets the id of the local participant. A user is assigned a new id each time they join a hangout.</summary>
			/// <example>hangout65A4C551_ephemeral.id.google.com^354e9d1ed0</example>
			/// <returns type="string"></returns>
			return PARTICIPANT.id;
		}

		this.getParticipants = function () {
			/// <summary>
			///		Gets the participants in the hangout.
			///		&#10; - Note that the list of participants reflects the current state on the hangouts server.
			///		&#10; - There may be a small window of time where the local participant (returned from getParticipantId()) is not in the returned array.
			///	</summary>
			/// <returns type="Array.&lt;gapi.hangout.Participant&gt;"></returns>
			return participants_;
		}

		this.hideApp = function () {
			/// <summary>
			///		Hide the app and show the video feed in the main hangout window.
			///		&#10; - The app will continue to run while it is hidden.
			///	</summary>
			/// <returns type="undefined"></returns>
			appVisible_ = false;
		}

		this.isApiReady = function () {
			/// <summary>
			///		Returns true if the gapi.hangout API is initialized; false otherwise.
			///		&#10; - Before the API is initialized, data values may have unexpected values.
			///	</summary>
			/// <returns type="boolean"></returns>
			return apiReady_;
		}

		this.isAppVisible = function () {
			/// <summary>Returns true if the app is visible in the main hangout window, false otherwise.</summary>
			/// <returns type="boolean"></returns>
			return appVisible_;
		}


		/*
		Event Functions
		*/

		this.onAppVisible = new function () {
			var callbacks = [];
			this.add = function (callback) {
				/// <summary>
				///		Adds a callback to be called when the gapi.hangout API becomes ready to use.
				///		&#10; - If the API is already initialized, the callback will be called at the next event dispatch.
				///	</summary>
				/// <param type="function(gapi.hangout.ApiReadyEvent)" name="callback">The callback to add.</param>
				callbacks.push(callback);
			}
			this.remove = function (callback) {
				/// <summary>Removes a callback previously added by onApiReady.add.</summary>
				/// <param type="function(gapi.hangout.ApiReadyEvent)" name="callback">The callback to add.</param>
				callbacks.splice(callbacks.indexOf(callback), 1);
			}
			// Private method
			this.trigger_ = function () {
				$.each(callbacks, function (callbackIndex, callback) {
					callback(new AppVisibleEvent());
				});
			}
		}

		this.onEnabledParticipantsChanged = new function () {
			var callbacks = [];
			this.add = function (callback) {
				/// <summary>
				///		Adds a callback to be called whenever the set of "participants with the app enabled" changes.
				///		&#10; - The argument to the callback is an event that holds all participants who have enabled the app since the last time the event fired.
				///	</summary>
				/// <param type="function(gapi.hangout.EnabledParticipantsChangedEvent)" name="callback">The callback to add.</param>
				callbacks.push(callback);
			}
			this.remove = function (callback) {
				/// <summary>Removes a callback previously added by onEnabledParticipantsChanged.add.</summary>
				/// <param type="function(gapi.hangout.EnabledParticipantsChangedEvent)" name="callback">The callback to remove.</param>
				callbacks.splice(callbacks.indexOf(callback), 1);
			}
			// Private method
			this.trigger_ = function () {
				$.each(callbacks, function (callbackIndex, callback) {
					callback(new EnabledParticipantsChangedEvent());
				});
			}
		}

		this.onParticipantsAdded = new function () {
			var callbacks = [];
			this.add = function (callback) {
				/// <summary>
				///		Adds a callback to be called whenever participants join the hangout.
				///		&#10; - The argument to the callback is an event that holds the particpants who have joined since the last time the event fired.
				///	</summary>
				/// <param type="function(gapi.hangout.ParticipantsAddedEvent)" name="callback">The callback to add.</param>
				callbacks.push(callback);
			}
			this.remove = function (callback) {
				/// <summary>Removes a callback previously added by onParticipantsAdded.add.</summary>
				/// <param type="function(gapi.hangout.ParticipantsAddedEvent)" name="callback">The callback to remove.</param>
				callbacks.splice(callbacks.indexOf(callback), 1);
			}
			// Private method
			this.trigger_ = function () {
				$.each(callbacks, function (callbackIndex, callback) {
					callback(new ParticipantsAddedEvent());
				});
			}
		}

		this.onParticipantsChanged = new function () {
			var callbacks = [];
			this.add = function (callback) {
				/// <summary>
				///		Adds callback to be called whenever there is any change in the participants in the hangout.
				///		&#10; - The argument to the callback is an event that holds holds the participants currently in the hangout.
				///	</summary>
				/// <param type="function(gapi.hangout.ParticipantsChangedEvent)" name="callback">The callback to add.</param>
				callbacks.push(callback);
			}
			this.remove = function (callback) {
				/// <summary>Removes a callback previously added by onParticipantsChanged.add.</summary>
				/// <param type="function(gapi.hangout.ParticipantsChangedEvent)" name="callback">The callback to remove.</param>
				callbacks.splice(callbacks.indexOf(callback), 1);
			}
			// Private method
			this.trigger_ = function () {
				$.each(callbacks, function (callbackIndex, callback) {
					callback(new ParticipantsChangedEvent());
				});
			}
		}

		this.onParticipantsDisabled = new function () {
			var callbacks = [];
			this.add = function (callback) {
				/// <summary>
				///		Adds a callback to be called whenever participants disable this app.
				///		&#10; - The argument to the callback is an event that holds the participants who have disabled the app since the last time the event fired.
				///	</summary>
				/// <param type="function(gapi.hangout.ParticipantsDisabledEvent)" name="callback">The callback to add.</param>
				callbacks.push(callback);
			}
			this.remove = function (callback) {
				/// <summary>Removes a callback previously added by onParticipantsDisabled.add.</summary>
				/// <param type="function(gapi.hangout.ParticipantsDisabledEvent)" name="callback">The callback to remove.</param>
				callbacks.splice(callbacks.indexOf(callback), 1);
			}
			// Private method
			this.trigger_ = function () {
				$.each(callbacks, function (callbackIndex, callback) {
					callback(new ParticipantsDisabledEvent());
				});
			}
		}

		this.onParticipantsEnabled = new function () {
			var callbacks = [];
			this.add = function (callback) {
				/// <summary>
				///		Adds a callback to be called whenever a participant in the hangout enables this app.
				///		&#10; - The argument to the callback is an event that holds the set of participants who have enabled the app since the last time the event fired.
				///	</summary>
				/// <param type="function(gapi.hangout.ParticipantsEnabledEvent)" name="callback">The callback to add.</param>
				callbacks.push(callback);
			}
			this.remove = function (callback) {
				/// <summary>Removes a callback prev iously added by onParticipantsEnabled.add.</summary>
				/// <param type="function(gapi.hangout.ParticipantsEnabledEvent)" name="callback">The callback to remove.</param>
				callbacks.splice(callbacks.indexOf(callback), 1);
			}
			// Private method
			this.trigger_ = function () {
				$.each(callbacks, function (callbackIndex, callback) {
					callback(new ParticipantsEnabledEvent());
				});
			}
		}

		this.onParticipantsRemoved = new function () {
			var callbacks = [];
			this.add = function (callback) {
				/// <summary>
				///		Adds a callback to be called whenever participants leave the hangout.
				///		&#10; - The argument to the callback is an event that holds the participants who have left since the last time the event fired.
				///	</summary>
				/// <param type="function(gapi.hangout.ParticipantsRemovedEvent)" name="callback">The callback to add.</param>
				callbacks.push(callback);
			}
			this.remove = function (callback) {
				/// <summary>Removes a callback previously added by onParticipantsRemoved.add.</summary>
				/// <param type="function(gapi.hangout.ParticipantsRemovedEvent)" name="callback">The callback to remove.</param>
				callbacks.splice(callbacks.indexOf(callback), 1);
			}
			// Private method
			this.trigger_ = function () {
				$.each(callbacks, function (callbackIndex, callback) {
					callback(new ParticipantsRemovedEvent());
				});
			}
		}

		/*
		init
		*/

		PARTICIPANT = new this.Participant(makeIdHelper_(12), true, true, true,
			makeIdHelper_(7), "William-" + makeIdHelper_(4), "https://lh5.googleusercontent.com/-FQa0HRy7ZsE/AAAAAAAAAAI/AAAAAAAAAAA/JDl93NPYKnM/s96-c/photo.jpg");
		PARTICIPANT.displayIndex = participants_.length + removedParticipants_.length;

		var serverParticipants = Storage.get("participants", []);
		serverParticipants.push(PARTICIPANT);
		Storage.set("participants", serverParticipants);

		// add to local storage to not fire added event
		participants_ = serverParticipants;

		/*
		$(window).bind('beforeunload', function () {
		var serverParticipants = Storage.get("participants", []);
		serverParticipants.splice(serverParticipants.indexOf(PARTICIPANT), 1);
		Storage.set("participants", serverParticipants);
		removedParticipants_.push(PARTICIPANT);
		});
		*/

		/*
		Update loop
		*/
		setInterval(function () {

			var hasChanged = false,
				newParticipants_ = Storage.get("participants"),
				currentTime = newTimestamp();

			addedParticipants_ = [];
			removedParticipants_ = [];

			if (participants_.length > 0) {
				$.each(participants_, function (a, x) {
					var exists = false;
					$.each(newParticipants_, function (u, p) {
						if (x.id == p.id) {
							exists = true;
						}
					});
					if (!exists) {
						removedParticipants_.push(x);
					}
				});
			}

			$.each(newParticipants_, function (i, p) {
				// type differences means you can't do indexOf
				var exists = false;
				$.each(participants_, function (n, y) {
					if (p.id == y.id) {
						exists = true;
					}
				});
				if (!exists) {
					addedParticipants_.push(p);
				}
			});

			if (addedParticipants_.length > 0) {
				gapi.hangout.onParticipantsAdded.trigger_();
				hasChanged = true;
			}

			if (removedParticipants_.length > 0) {
				gapi.hangout.onParticipantsRemoved.trigger_();
				hasChanged = true;
			}

			participants_ = newParticipants_;

			if (hasChanged) {
				gapi.hangout.onParticipantsChanged.trigger_();
			}


			/*
			Get users who haven't updated their data in the timeout period
			*/

			var userDeltaTimestamps = getUserDeltaTimestamps(),
				serverParticipants = Storage.get("participants", []);

			$.each(userDeltaTimestamps, function (userDeltaKey, userDeltaTimestamp) {
				$.each(serverParticipants, function (serverParticipantIndex, serverParticipant) {

					if (serverParticipant && userDeltaKey == serverParticipant.id) {
						// user hasn't updated in a while
						if (currentTime > userDeltaTimestamp + TIMEOUT) {
							delete userDeltaTimestamps[userDeltaKey];
							serverParticipants.splice(serverParticipantIndex, 1);
						}

					}

				});


			});


			Storage.set("userDeltaTimestamps", userDeltaTimestamps);
			Storage.set("participants", serverParticipants);

		}, UPDATE_RATE);







		/*****************************************************\
		*
		* gapi.hangout.av
		*
		\*****************************************************/

		this.av = new function () {

			/*
			Private
			*/

			var isCameraMute_ = hasCamera_ = hasMicrophone_ = hasSpeakers_ = isMicrophoneMute_ = false,
				volumes = {}


			/*
			Classes
			*/

			var CameraMuteEvent = function () {
				/// <summary>Provides information about a CameraMute event.</summary>
				/// <returns name="isCameraMute" type="boolean">Indicates whether the local participant is sending video.</returns>
				this.isCameraMute = isCameraMute_;
			}

			var HasCameraEvent = function () {
				/// <summary>Provides information about a HasCamera event.</summary>
				/// <returns name="hasCamera" type="boolean">Indicates whether the local participant's camera is activated.</returns>
				this.hasCamera = hasCamera_;
			}

			var HasMicrophoneEvent = function () {
				/// <summary>Provides information about HasMicrophone events.</summary>
				/// <returns name="hasMicrophone" type="boolean">Indicates whether the local participant's microphone is activated.</returns>
				this.hasMicrophone = hasMicrophone_;
			}

			var HasSpeakersEvent = function () {
				/// <summary>Provides information about HasSpeakers events.</summary>
				/// <returns name="hasSpeakers" type="boolean">Indicates whether the local participant's audio speakers are activated.</returns>
				this.hasSpeakers = hasSpeakers_;
			}

			var MicrophoneMuteEvent = function () {
				/// <summary>Provides information about MicrophoneMuted events.</summary>
				/// <returns name="isMicrophoneMute" type="boolean">Indicates whether the local participant's mic is muted.</returns>
				this.isMicrophoneMute = isMicrophoneMute_;
			}

			var VolumesChangedEvent = function () {
				/// <summary>Provides information about VolumesChanged events.</summary>
				/// <returns name="volumes" type="Object.&lt;string, number&gt;">The volume level for each participant, keyed by participant id.</returns>
				this.volumes = volumes_;
			}


			/*
			Functions
			*/

			this.clearAvatar = function (participantId) {
				/// <summary>Resumes display of the video stream for a participant. Note this affects only the view of the local participant.</summary>
				/// <param name="participantId" type="string">The id of the participant.</param>
				/// <returns type="undefined"></returns>

				console.error("Not implemented");
				// TODO parent.postMessage("message", "*");

			}

			// BUG: Should return 2 element array
			// https://developers.google.com/+/hangouts/reference#gapi.hangout.av.getParticipantAudioLevel
			this.getParticipantAudioLevel = function (participantId) {
				/// <summary>
				///		Gets the audio level for a participant as set by setParticipantAudioLevel.
				///		&#10; - Returns a two-element array where the first element is the level of the left audio channel and the second element is the level of the right audio channel.
				///	</summary>
				/// <param name="participantId" type="string">The id of the participant.</param>
				/// <returns type="undefined"></returns>

				console.error("Not implemented");
			}

			this.getAvatar = function (participantId) {
				/// <summary>
				///		Gets the URL for the avatar image for the given participant.
				///		&#10; - Returns undefined if no avatar image is set for the participant.
				///	</summary>
				/// <param name="participantId" type="string">The id of the participant.</param>
				/// <returns type="string"></returns>

				console.error("Not implemented");
			}

			this.getCameraMute = function () {
				/// <summary>Returns true if the local participants camera is currently sending video; false otherwise.</summary>
				/// <returns type="boolean"></returns>

				console.error("Not implemented");
			}

			this.getMicrophoneMute = function () {
				/// <summary>Returns true if the mic is muted for the local participant; false otherwise.</summary>
				/// <returns type="boolean"></returns>

				console.error("Not implemented");
			}

			this.getParticipantVolume = function (participantId) {
				/// <summary>Gets the current audio volume for the given participant, a number from 0 to 5, inclusive.</summary>
				/// <param name="participantId" type="string">The id of the participant.</param>
				/// <returns type="number"></returns>

				console.error("Not implemented");
			}

			this.getVolumes = function () {
				/// <summary>
				///		Gets the current audio volume level for all participants.
				///		&#10; - Returns an object with key/value pairs where the key is the participant id and the value is the volume for that participant.
				///		&#10; - The volume is a number from 0 to 5, inclusive.
				///	</summary>
				/// <returns type="Object.&lt;string, number&gt;"></returns>

				console.error("Not implemented");
			}

			this.hasCamera = function () {
				/// <summary>Returns true if the local participant has an active camera, false otherwise.</summary>
				/// <returns type="boolean"></returns>

				console.error("Not implemented");
			}

			this.hasMicrophone = function () {
				/// <summary>Returns true if the local participant has a working mic, false otherwise.</summary>
				/// <returns type="boolean"></returns>

				console.error("Not implemented");
			}

			this.hasSpeakers = function () {
				/// <summary>True if the local participant has working audio speakers, false otherwise.</summary>
				/// <returns type="boolean"></returns>

				console.error("Not implemented");
			}

			this.isParticipantAudible = function (participantId) {
				/// <summary>Retrieves the state of setParticipantAudible.</summary>
				/// <param name="participantId" type="string">The id of the participant.</param>
				/// <returns type="number"></returns>

				console.error("Not implemented");
			}

			this.isParticipantVisible = function (participantId) {
				/// <summary>Retrieves the state of setParticipantVisible.</summary>
				/// <param name="participantId" type="string">The id of the participant.</param>
				/// <returns type="number"></returns>

				console.error("Not implemented");
			}

			this.requestParticipantMicrophoneMute = function (participantId) {
				/// <summary>Prompts the participant to mute their audio.</summary>
				/// <param name="participantId" type="string">The id of the participant.</param>
				/// <returns type="undefined"></returns>

				console.error("Not implemented");
			}

			this.setParticipantAudioLevel = function (participantId, audioLevel) {
				/// <summary>
				///		Sets the audio level of a participant as heard by only the local participant.
				///		&#10; - The audio level for a participant is in the range 0-10 with 1 being the default, 
				///		a number from 0 to 1 indicating that the audio should be quieter than the default and a number 
				///		from 1 to 10 indicating that the audio should be louder than the default.
				///		&#10; - The audio level can also be set independently for the right and left audio channels.
				///	</summary>
				/// <param name="participantId" type="string">The id of the participant.</param>
				/// <param name="audioLevel" type="number|Array.&lt;number&gt;">
				///		Either a single number indicating the audio level that should be set for both the right and left channels, 
				///		or an array whose first element is the level for the left audio channel and second element is the level for the right audio channel.
				/// </param>
				/// <returns type="undefined"></returns>

				console.error("Not implemented");
			}

			this.setAvatar = function (participantId, imageUrl) {
				/// <summary>
				///		Shows an image in place of the video stream for a participant. Note this affects only the view seen by the local participant.
				///		&#10; - The other participants in the hangout will still see the video stream for the given participant.
				///	</summary>
				/// <param name="participantId" type="string">The id of the participant.</param>
				/// <param name="imageUrl " type="string">The URL of an image to show as the video stream for the given participant.</param>
				/// <returns type="undefined"></returns>

				console.error("Not implemented");
			}

			this.setCameraMute = function (muted) {
				/// <summary>Starts or stops the local participant from sending video to the other hangout participants.</summary>
				/// <param name="muted" type="boolean">True if the local participant should stop sending video.</param>
				/// <returns type="undefined"></returns>

				console.error("Not implemented");
			}

			this.clearCameraMute = function () {
				/// <summary>Reverts the camera mute state to the last state set by the user.</summary>
				/// <returns type="undefined"></returns>

				console.error("Not implemented");
			}

			this.setMicrophoneMute = function (muted) {
				/// <summary>Mutes or unmutes the mic for the local participant.</summary>
				/// <param name="muted" type="boolean">True if the local participant should be muted.</param>
				/// <returns type="undefined"></returns>

				console.error("Not implemented");
			}

			this.clearMicrophoneMute = function () {
				/// <summary>Reverts the mic mute state to the last state set by the user.</summary>
				/// <returns type="undefined"></returns>

				console.error("Not implemented");
			}

			this.setParticipantAudible = function (participantId, audible) {
				/// <summary>Sets the mute state of a participant as heard by only the local participant.</summary>
				/// <param name="participantId" type="string">The id of a participant.</param>
				/// <param name="audible" type="boolean">Indicates whether the given participant's audio should be heard by the local participant.</param>
				/// <returns type="undefined"></returns>

				console.error("Not implemented");
			}

			this.setParticipantVisible = function (participantId, visible) {
				/// <summary>Sets the mute state of a participant as heard by only the local participant.</summary>
				/// <param name="participantId" type="string">The id of a participant.</param>
				/// <param name="audible" type="boolean">True if the given participant should be visible to the local participant.</param>
				/// <returns type="undefined"></returns>

				console.error("Not implemented");
			}


			/*
			Event Functions
			*/

			this.onCameraMute = new function () {
				var callbacks = [];
				this.add = function (callback) {
					/// <summary>Adds a callback to be called when the local participant starts or stops sending video.</summary>
					/// <param type="function(gapi.hangout.av.CameraMuteEvent)" name="callback">The callback to add.</param>
					callbacks.push(callback);
				}
				this.remove = function (callback) {
					/// <summary>Removes a callback previously added by onCameraMute.add.</summary>
					/// <param type="function(gapi.hangout.av.CameraMuteEvent)" name="callback">The callback to remove.</param>
					callbacks.splice(callbacks.indexOf(callback), 1);
				}
				// Private method
				this.trigger_ = function () {
					$.each(callbacks, function (callbackIndex, callback) {
						callback(new CameraMuteEvent());
					});
				}
			}

			this.onHasCamera = new function () {
				var callbacks = [];
				this.add = function (callback) {
					/// <summary>
					///		Adds a callback to be called when the local participant activates or deactivates their camera.
					///		&#10; - "Activate" means the camera is connected and available (whether muted or not muted).
					/// </summary>
					/// <param type="function(gapi.hangout.av.HasCameraEvent)" name="callback">The callback to add.</param>
					callbacks.push(callback);
				}
				this.remove = function (callback) {
					/// <summary>Removes a callback previously added by onHasCamera.add.</summary>
					/// <param type="function(gapi.hangout.av.HasCameraEvent)" name="callback">The callback to remove.</param>
					callbacks.splice(callbacks.indexOf(callback), 1);
				}
				// Private method
				this.trigger_ = function () {
					$.each(callbacks, function (callbackIndex, callback) {
						callback(new HasCameraEvent());
					});
				}
			}

			this.onHasMicrophone = new function () {
				var callbacks = [];
				this.add = function (callback) {
					/// <summary>
					///		Adds a callback to be called when the local participant activates or deactivates their mic.
					///		&#10; - "Activate" means the mic is connected and available (whether muted or not muted).
					/// </summary>
					/// <param type="function(gapi.hangout.av.HasMicrophoneEvent)" name="callback">The callback to add.</param>
					callbacks.push(callback);
				}
				this.remove = function (callback) {
					/// <summary>Removes a callback previously added by onHasMicrophone.add.</summary>
					/// <param type="function(gapi.hangout.av.HasMicrophoneEvent)" name="callback">The callback to remove.</param>
					callbacks.splice(callbacks.indexOf(callback), 1);
				}
				// Private method
				this.trigger_ = function () {
					$.each(callbacks, function (callbackIndex, callback) {
						callback(new HasMicrophoneEvent());
					});
				}
			}

			this.onHasSpeakers = new function () {
				var callbacks = [];
				this.add = function (callback) {
					/// <summary>
					///		Adds a callback to be called when the local participant activates or deactivates their audio speakers.
					///		&#10; - "Activate" means the speakers are connected and available (whether the volume is turned up or down).
					/// </summary>
					/// <param type="function(gapi.hangout.av.HasSpeakersEvent)" name="callback">The callback to add.</param>
					callbacks.push(callback);
				}
				this.remove = function (callback) {
					/// <summary>Removes a callback previously added by onHasSpeakers.add.</summary>
					/// <param type="function(gapi.hangout.av.HasSpeakersEvent)" name="callback">The callback to remove.</param>
					callbacks.splice(callbacks.indexOf(callback), 1);
				}
				// Private method
				this.trigger_ = function () {
					$.each(callbacks, function (callbackIndex, callback) {
						callback(new HasSpeakersEvent());
					});
				}
			}

			this.onMicrophoneMute = new function () {
				var callbacks = [];
				this.add = function (callback) {
					/// <summary>Adds a callback to be called when the mic mute state for the local participant changes.</summary>
					/// <param type="function(gapi.hangout.av.MicrophoneMuteEvent)" name="callback">The callback to add.</param>
					callbacks.push(callback);
				}
				this.remove = function (callback) {
					/// <summary>Removes a callback previously added by onMicrophoneMute.add.</summary>
					/// <param type="function(gapi.hangout.av.MicrophoneMuteEvent)" name="callback">The callback to remove.</param>
					callbacks.splice(callbacks.indexOf(callback), 1);
				}
				// Private method
				this.trigger_ = function () {
					$.each(callbacks, function (callbackIndex, callback) {
						callback(new MicrophoneMuteEvent());
					});
				}
			}

			this.onVolumesChanged = new function () {
				var callbacks = [];
				this.add = function (callback) {
					/// <summary>
					///		Adds a callback to be called when the audio volume levels at the source changes for any participant.
					///		&#10; - The argument to the callback is an event that holds the new volume levels for all participants.
					/// </summary>
					/// <param type="function(gapi.hangout.av.VolumesChangedEvent)" name="callback">The callback to add.</param>
					callbacks.push(callback);
				}
				this.remove = function (callback) {
					/// <summary>Removes a callback previously added by onVolumesChanged.add.</summary>
					/// <param type="function(gapi.hangout.av.VolumesChangedEvent)" name="callback">The callback to remove.</param>
					callbacks.splice(callbacks.indexOf(callback), 1);
				}
				// Private method
				this.trigger_ = function () {
					$.each(callbacks, function (callbackIndex, callback) {
						callback(new VolumesChangedEvent());
					});
				}
			}


			/*
			Update loop
			*/

			// setInterval(function() {}, UPDATE_RATE);


			/*****************************************************\
			*
			* gapi.hangout.av.effects
			*
			\*****************************************************/

			this.effects = new function () {

				/*
				Classes
				*/

				this.AudioResource = function (url) {
					/// <summary>
					///		Object used to load an audio file which can be used to play sound effects.
					///		&#10; - Create an AudioResource with createAudioResource.
					///	</summary>
					/// <param name="url" type="string">Private variable for local use</param>
					var url_ = url;

					this.createSound = function (opt_params) {
						/// <summary>Creates a new instance of a sound effect.</summary>
						/// <param name="opt_params" type="Object">{loop: boolean, volume: number}</param>
						/// <returns type="gapi.hangout.av.effects.Sound"></returns>
					}

					this.getUrl = function () {
						/// <summary>Returns the URL of the audio file for the resource.</summary>
						/// <returns type="string"></returns>
					}

					this.play = function (opt_params) {
						/// <summary>Creates a new instance of a sound effect and starts it playing.</summary>
						/// <param name="opt_params" type="Object">{loop: boolean, volume: number}</param>
						/// <returns type="gapi.hangout.av.effects.Sound"></returns>
					}

				}

				this.FaceTrackingOverlay = function () {
					/// <summary>
					///		Object used to control one instance of an image overlaid on the video feed of the local participant.
					///		&#10; - Only one overlay can be visible at a time.
					///		&#10; - Create a FaceTrackingOverlay using createFaceTrackingOverlay or showFaceTrackingOverlay.
					///	</summary>

					this.FaceTrackingFeature = {
						LEFT_EYE: "LEFT_EYE",
						LOWER_LIP: "LOWER_LIP",
						NOSE_ROOT: "NOSE_ROOT",
						NOSE_TIP: "NOSE_TIP",
						RIGHT_EYE: "RIGHT_EYE",
						UPPER_LIP: "UPPER_LIP",
					};

					this.getImageResource = function () {
						/// <summary>Returns the ImageResource used to create this object.</summary>
						/// <returns type="gapi.hangout.av.effects.ImageResource"></returns>
					}

					this.getOffset = function () {
						/// <summary>
						///		Returns the offset of the image overlay from the feature.
						///		&#10; - See setOffset for a description of the x and y values.
						///	</summary>
						/// <returns type="Object&lt;x:number,y:number&gt;"></returns>
					}

					this.getRotateWithFace = function () {
						/// <summary>Returns whether the image will rotate as the face rotates.</summary>
						/// <returns type="boolean"></returns>
					}

					this.getRotation = function () {
						/// <summary>
						///		Returns the base rotation of an image in radians.
						///		&#10; - This does not include any rotation occurring because of the getRotateWithFace flag.
						///	</summary>
						/// <returns type="number"></returns>
					}

					this.getScale = function () {
						/// <summary>
						///		Returns the scale in relation to the natural image size of the overlay.
						///		&#10; - This does not include any scaling occurring because of the getScaleWithFace flag.
						///	</summary>
						/// <example>A scale of 2 would cause the image to be twice its natural size.</example>
						/// <returns type="number"></returns>
					}

					this.getScaleWithFace = function () {
						/// <summary>Returns whether the size of the image will scale with the size of the face that is being tracked.</summary>
						/// <returns type="boolean"></returns>
					}

					this.getTrackingFeature = function () {
						/// <summary>Returns the feature of the face that the image overlay is attached to.</summary>
						/// <returns type="gapi.hangout.av.effects.FaceTrackingFeature"></returns>
					}

					this.isVisible = function () {
						/// <summary>
						///		Returns whether the image overlay is currently visible in the local participant's video feed.
						///		&#10; - There can be only one overlay visible at a time in any given video stream.
						///	</summary>
						/// <returns type="boolean"></returns>
					}

					this.setOffset = function (value, opt_y) {
						/// <summary>
						///		Sets the offset of the image overlay from the feature of the face being tracked.
						///		&#10; - With an offset of (0,0), the overlay is centered on the feature.
						///		&#10;
						///		The x offset ranges from -1 to 1, where 1 is the width of the video feed, and positive values move the overlay toward the right.
						///		&#10; - The y offset also ranges from -1 to 1, where 1 is the height of the video feed, and postive values move the overlay toward the bottom.
						///	</summary>
						///	<param name="value" type="number|Object.&lt;x:number,y:number&gt;">Either a single number representing the x offset, or an object with the x, y offset.</param>
						//	<param name="opt_y" type="number">The y offset (this parameter is ignored if value is an object.)</param>
						/// <returns type="undefined"></returns>
					}

					this.setRotateWithFace = function (shouldRotate) {
						/// <summary>Sets whether the image should rotate as the face rotates.</summary>
						///	<param name="shouldRotate" type="boolean">Whether the image should rotate with the face.</param>
						/// <returns type="undefined"></returns>
					}

					this.setRotation = function (rotation) {
						/// <summary>
						///		Sets the rotation for an image.
						///		&#10; - This will be in addition to any rotation caused by setRotateWithFace.
						///	</summary>
						///	<param name="rotation" type="number">The angle of rotation for the image, in radians.</param>
						/// <returns type="undefined"></returns>
					}

					this.setScale = function (scale) {
						/// <summary>Sets the amount an image should be scaled.</summary>
						///	<param name="scale" type="number">The amount an image should be scaled relative to it's normal size.</param>
						/// <returns type="undefined"></returns>
					}

					this.setScaleWithFace = function (shouldScale) {
						/// <summary>Sets whether an image should scale as the face being tracked gets larger or smaller.</summary>
						///	<param name="shouldScale" type="boolean">Whether the image should scale with the face. of the face.</param>
						/// <returns type="undefined"></returns>
					}

					this.setTrackingFeature = function (feature) {
						/// <summary>Sets the face feature that the image overlay is attached to.</summary>
						///	<param name="feature" type="gapi.hangout.av.effects.FaceTrackingFeature">The feature to track.</param>
						/// <returns type="undefined"></returns>
					}

					this.setVisible = function (visible) {
						/// <summary>
						///		Sets the image overlay to be visible or not.
						///		&#10; - Each time your app calls setVisible(true), it sets the overlay to be visible and automatically hides all other overlays.
						///	</summary>
						///	<param name="visible" type="boolean">Whether the the overlay is visible.</param>
						/// <returns type="undefined"></returns>
					}

				}

				this.ImageResource = function (url) {
					/// <summary>
					///		Object used to load an image file which can be overlaid on the video feed.
					///		&#10; - Create an ImageResource with createImageResource.
					///	</summary>
					/// <param name="url" type="string">Private variable for local use</param>
					var url_ = url;

					this.createFaceTrackingOverlay = function (opt_params) {
						/// <summary>Creates a new instance of a face tracking overlay with this image.</summary>
						///	<param name="opt_params" type="Object&lt;trackingFeature:gapi.hangout.av.effects.FaceTrackingFeature,offset:&lt;x:number,y:number&gt;,rotateWithFace:boolean,rotation:number,scale:number,scaleWithFace:boolean&gt;">The options for the newly created image overlay.</param>
						/// <returns type="gapi.hangout.av.effects.FaceTrackingOverlay"></returns>
					}

					this.showFaceTrackingOverlay = function (opt_params) {
						/// <summary>
						///		Creates a new instance of a face tracking overlay with this image and starts displaying it.
						///		&#10; - Each time your app shows a new overlay with this function, it automatically hides all other overlays.
						///	</summary>
						///	<param name="opt_params" type="Object&lt;trackingFeature:gapi.hangout.av.effects.FaceTrackingFeature,offset:&lt;x:number,y:number&gt;,rotateWithFace:boolean,rotation:number,scale:number,scaleWithFace:boolean&gt;">The options for the newly created image overlay.</param>
						/// <returns type="gapi.hangout.av.effects.FaceTrackingOverlay"></returns>
					}

					this.getUrl = function() {
						/// <summary>The URL of the image file for the resource.</summary>
						/// <returns type="string"></returns>
					}

				}

				this.Sound = function () {
					/// <summary>
					///		Object used to control one instance of a sound effect.
					///		&#10; - Sounds played through this API will automatically be echo-cancelled.
					//		&#10; - You can have many instances of AudioResources available, but can play only one Sound at a time.
					///		&#10; - Create a Sound using createAudioResource.
					///	</summary>

					this.getAudioResource = function() {
						/// <summary>The AudioResource used to create this Sound.</summary>
						/// <returns type="gapi.hangout.av.effects.AudioResource"></returns>
					}

					this.getVolume = function() {
						/// <summary>The volume, in the range 0-1, of the sound effect.</summary>
						/// <returns type="number"></returns>
					}

					this.isLooped = function() {
						/// <summary>Returns true if the sound effect will repeat.</summary>
						/// <returns type="boolean"></returns>
					}

					this.play = function() {
						/// <summary>Starts playing the sound effect.</summary>
						/// <returns type="undefined"></returns>
					}

					this.setLoop = function(loop) {
						/// <summary>Sets whether the sound effect will repeat or not.</summary>
						///	<param name="loop" value="boolean">Whether the sound effect will repeat.</param>
						/// <returns type="undefined"></returns>
					}

					this.setVolume = function(volume) {
						/// <summary>Sets the volume of the sound effect.</summary>
						///	<param name="volume" value="number">The desired volume of the sound effect, in the range 0-1.</param>
						/// <returns type="undefined"></returns>
					}

					this.stop = function() {
						/// <summary>Stops the sound effect if it is currently playing.</summary>
						/// <returns type="undefined"></returns>
					}

				}


				/*
				Functions
				*/

				this.createAudioResource = function(url) {
					/// <summary>
					///		Creates a new AudioResource.
					///		&#10; [!] Warning: Creating an audio or image resource will allocate memory in the plugin. At this time, you cannot release these resources, so allocating too many resources can cause the hangout to run out of memory and halt.
					///	</summary>
					///	<param name="url" value="string">
					///		The URL of the sound file.
					///		&#10; - Only 16 bit PCM encoded WAV files are supported and loading is only supported over http.
					///	</param>
					/// <returns type="gapi.hangout.av.effects.AudioResource"></returns>
					
					return new gapi.hangout.av.effects.AudioResource(url);

				}

				this.createImageResource = function(url) {
					/// <summary>
					///		Creates a new gapi.hangout.av.effects.ImageResource.
					///		&#10; [!] Warning: Creating an audio or image resource will allocate memory in the plugin. At this time, you cannot release these resources, so allocating too many resources can cause the hangout to run out of memory and halt.
					///	</summary>
					///	<param name="url" value="string">
					///		The URL of the image.
					///		&#10; - Only PNG and JPEG files are supported and loading is only supported over http.
					///	</param>
					/// <returns type="gapi.hangout.av.effects.ImageResource"></returns>

					return new gapi.hangout.av.effects.ImageResource(url);
				}


			}

		}





		/*****************************************************\
		*
		* gapi.hangout.data
		*
		\*****************************************************/

		this.data = new function () {


			/*
			Private
			*/

			var self = this,
					localDelta = {
						updates: [],
						removes: [],
						timestamp: getDelta().timestamp
					};

			function getDelta() {
				return Storage.get("delta", {
					updates: [],
					removes: [],
					timestamp: newTimestamp()
				});
			}



			/*
			Classes
			*/

			var StateChangedEvent = function(addedKeys, removedKeys) {
				/// <summary>Contains information relating to a change in the shared state.</summary>
				/// <param name="addedKeys" type="Array.&lt;Object&gt;">
				///		An array containing the newly added entries to the state metadata.
				///		&#10; - See getStateMetadata for more information.
				///	</param>
				/// <param name="metadata" type="Object.&lt;string, Object&gt;">
				///		The state metadata, also available via getStateMetadata.
				///	</param>
				/// <param name="removedKeys" type="Array.&lt;string&gt;">
				///		List of the keys removed in this update.
				///	</param>
				/// <param name="state" type="Object.&lt;string, string&gt;">
				///		The shared state, also available via getState.
				///	</param>

				this.addedKeys = addedKeys || [];
				this.metadata = self.getStateMetadata();
				this.removedKeys = removedKeys || [];
				this.state = self.getState();
			}

			/*
			Functions
			*/

			this.clearValue = function (key) {
				/// <summary>Clears a single key/value pair.</summary>
				/// <remarks>This does not clear straightaway, it calls submitDelta</remarks>
				/// <returns type="undefined"></summary>
				this.submitDelta({}, [key]);
			}

			this.getKeys = function () {
				/// <summary>Gets the keys in the shared state object, an array of strings.</summary>
				/// <returns type="Array.&lt;string&gt;"></returns>
				var retVal = [];
				$.each(this.getState(), function (key) {
					retVal.push(key)
				});
				return retVal;
			}

			this.getValue = function (key) {
				/// <summary>Gets the keys in the shared state object, an array of strings.</summary>
				/// <param name="key" type="string">The key to get the value for.</param>
				/// <returns type="string"></returns>
				return this.getState()[key];
			}

			this.getState = function () {
				/// <summary>Gets the shared state object, a set of name/value pairs.</summary>
				/// <returns type="Object.&lt;string,string&gt;"></returns>
				var state = Storage.get("state", {});
				return state;
			}


			this.getStateMetadata = function () {
				/// <summary>
				///		Gets the state metadata object, which contains the same key/value data as the shared state object retrieved via getState but augmented with additional information.
				///		&#10; - Each metadata entry includes:
				///		&#10;	key:		The key being added.
				///		&#10;	value:		The new value being set.
				///		&#10;	timestamp:	The server time that the key/value was most recently updated.
				///		&#10;	timediff:		The difference in time on the server between the current time and the time the key/value was most recently updated.
				///	</summary>
				/// <returns type="Object.&lt;string,Object&gt;"></returns>

				var retVal = {},
						timestamps = getTimestamps(),
						currentTime = newTimestamp();
				$.each(this.getState(), function (stateKey, stateValue) {
					retVal[stateKey] = {
						key: stateKey,
						value: stateValue,
						// The server time that the key/value was most recently updated.
						timestamp: timestamps[stateKey],
						// The difference in time on the server between the current time and the time the key/value was most recently updated.
						// Not working as expected on the live API
						timediff: currentTime - timestamps[stateKey]
					}

				});
				return retVal;
			}

			this.setValue = function (key, value) {
				/// <summary>Sets a single key value pair.</summary>
				/// <remarks>This does not set straightaway, it calls submitDelta</remarks>
				/// <param name="key" type="string">The key to set.</param>
				/// <param name="value" type="string">The value to set the key to.</param>
				/// <returns type="undefined"></returns>
				var delta = {};
				delta[key] = value;
				this.submitDelta(delta, []);
			}

			this.submitDelta = function (opt_updates, opt_removes) {
				/// <summary>Submits a request to update the value of the shared state object.</summary>
				/// <param name="opt_updates" type="Object.&lt;string, string&gt;">
				///		Key/value pairs to add or overwrite.
				///		&#10;The value in each key/value pair must be a string.
				///		&#10;Notably, the value must not be any of a number, boolean, object, array, function, null, or undefined.
				///	</param>
				/// <param name="opt_removes" type="Array.&lt;string&gt;">A (possibly empty) array of key names to remove.</param>
				/// <returns type="undefined"></returns>

				var delta = getDelta(),
						timestamp = newTimestamp();

				if (!$.isEmptyObject(opt_updates)) {
					var updateObj = {
						updates: opt_updates,
						timestamp: newTimestamp()
					}
					delta.updates.push(updateObj);
					localDelta.updates.push(updateObj);
					delta.timestamp = timestamp;
					localDelta.timestamp = timestamp;
				}

				if (opt_removes.length > 0) {
					var removeObj = {
						removes: opt_removes,
						timestamp: newTimestamp()
					}
					delta.removes.push(removeObj);
					localDelta.removes.push(removeObj);
					delta.timestamp = timestamp;
					localDelta.timestamp = timestamp;
				}

				Storage.set("delta", delta);

			}

			/*
			Event Functions
			*/

			this.onStateChanged = new function () {
				var callbacks = [];
				this.add = function (callback) {
					/// <summary>
					///		Adds a callback to be called when a new version of the shared state object is received from the server.
					///		&#10; - The first parameter of the callback contains an array of values added to the shared state object.
					///		&#10;	Each added value includes the following members:
					///		&#10;	 - key:		The key being added.
					///		&#10;	 - value:		The new value being set.
					///		&#10;	 - timestamp:	The server time that the key/value was most recently updated.
					///		&#10;	 - timediff:	The difference in time on the server between the current time and the time the key/value was most recently updated.
					///		&#10; - The second parameter to the callback contains an array of key names that have been removed from the shared state object.
					///		&#10; - The third paramater to the callback contains the current value of the shared state object.
					///		&#10; - The fourth parameter to the callback contains the current value of the metadata for the shared state object.
					///		&#10; - Note that the callback will be called for changes in the shared state which result from submitDelta calls made from this participant's app.
					///	</summary>
					/// <param name="callback" type="function(gapi.hangout.data.StateChangedEvent)">The callback to add.</param>


					callbacks.push(callback);
				}
				this.remove = function (callback) {
					/// <summary>Removes a callback previously added by onStateChanged.add.</summary>
					/// <param name="callback" type="function(gapi.hangout.data.StateChangedEvent)">The callback to remove.</param>
					callbacks.splice(callbacks.indexOf(callback), 1);
				}
				// Private method
				this.trigger_ = function (evt) {
					$.each(callbacks, function (callbackIndex, callback) {
						callback(evt);
					});
				}
			}



			/*
			Update loop
			*/

			setInterval(function () {

				var eventsToDispatch = [],
						currentTimestamp = newTimestamp(),
						delta = getDelta();



				// check if the stored delta timestamp is set later
				if (delta.timestamp > localDelta.timestamp) {


					// set local delta timestamp to stored delta's
					localDelta.timestamp = delta.timestamp;

					// go through each stored update item
					$.each(delta.updates, function (deltaUpdateItemIndex, updateItem) {


						// TODO: Use grep
						$.each(updateItem.updates, function (updateKey, updateValue) {

							var hasLocalItem = false;

							// for each stored update item, look through the local delta
							$.each(localDelta.updates, function (localDeltaUpdateItemIndex, localUpdateItem) {

								var local;

								$.each(localUpdateItem.updates, function (localUpdateKey, localUpdateValue) {


									// if there's a match set flag to true
									if (localUpdateKey == updateKey) {

										hasLocalItem = true;

										// if there's a newer stored delta than the local delta, update the local delta's item
										if (updateItem.timestamp >= localUpdateItem.timestamp) {
											local = updateItem;
											return;
										}

										// there could be future versions of the same object in the local store, so set it to the latest
										local = localUpdateItem;

									}


								});

								// update with either the latest version of the local, or the server's
								localDelta.updates[localDeltaUpdateItemIndex] = local;

							});


							if (!hasLocalItem) {
								localDelta.updates.push(updateItem);
							}


						});


					});

				}

				// iterate through each local delta update item
				$.each(localDelta.updates, function (localDeltaUpdateItemIndex, localUpdateItem) {

					$.each(localUpdateItem.updates, function (localUpdateKey, localUpdateValue) {

						var state = self.getState(),
								timestamps = getTimestamps();


						// assuming that whoever is setting the state has gone through the process of getting the latest data

						state[localUpdateKey] = localUpdateValue;
						Storage.set("state", state);
						timestamps[localUpdateKey] = currentTimestamp;
						Storage.set("timestamps", timestamps);

						eventsToDispatch.push(new StateChangedEvent([{
							key: localUpdateKey,
							value: localUpdateValue,
							timestamp: currentTimestamp,
							timediff: 0
						}]));


					});

				});

				if (eventsToDispatch.length > 0) {
					$.each(eventsToDispatch, function (i, evt) {
						self.onStateChanged.trigger_(evt);
					});
				}


				var lastUserToUpdateTimestamp = currentTimestamp;

				var userDeltaTimestamps = getUserDeltaTimestamps();
				userDeltaTimestamps[PARTICIPANT.id] = currentTimestamp;

				$.each(userDeltaTimestamps, function (i, userDeltaTimestamp) {
					lastUserToUpdateTimestamp = Math.min(lastUserToUpdateTimestamp, userDeltaTimestamp);
				});

				$.each(delta.updates, function (deleteItemIndex, deleteItem) {
					if (lastUserToUpdateTimestamp > delta.timestamp) {
						delta.updates.splice(deleteItemIndex, 1);
					}
				});

				Storage.set("userDeltaTimestamps", userDeltaTimestamps);
				Storage.set("delta", delta);

				localDelta.updates = [];
				localDelta.removes = [];

			}, UPDATE_RATE);


		}



	}

}