/// <reference path="jquery-vsdoc.js" />
/// <reference path="json2.min.js" />


window.onkeydown = function (e) {
	if (e.keyCode == 36) {
		localStorage.clear();
	}
};


this.gapi = new function () {

	this.hangout = new function () {

		// globals


		var USER = null,
			NAME = "hogswash",
			UPDATE_RATE = 100,
			TIMEOUT = 4;


		// participant type class

		function Participant(id, hasMicrophone, hasCamera, hasAppEnabled, personId, personDisplayName, personImgUrl) {
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


		// utility

		// localstorage handler

		var Storage = new function () {

			function getNestedObjectProperty(ob, key) {
				var path = key.split('.');
				var objTraversals = 0;
				function traverse(obj) {
					if (typeof obj == 'object') {
						for (var y in obj) {
							if (y == path[objTraversals]) {
								if (objTraversals == path.length - 1) {
									return obj[y];
								} else {
									objTraversals++;
									return traverse(obj[y]);
								}
							}
						}
					}
					return null;
				}
				for (var x in ob) {
					if (x == path[objTraversals]) {
						if (objTraversals == path.length - 1) {
							return ob[x] || "";
						} else {
							objTraversals++;
							return traverse(ob[x]);
						}
					}
				}
				return null;
			};

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




		// helper methods

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



		// participant private vars

		var participants_ = addedParticipants_ = removedParticipants_ = disabledParticipants_ = [],
			apiReady_ = appVisible_ = true;










		USER = new Participant(makeIdHelper_(12), true, true, true, makeIdHelper_(7), "William-" + makeIdHelper_(4), "test.jpg");
		USER.displayIndex = participants_.length + removedParticipants_.length;

		var serverParticipants = Storage.get("participants", []);
		serverParticipants.push(USER);
		Storage.set("participants", serverParticipants);

		// add to local storage to not fire added event
		participants_ = serverParticipants;


		// update

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


			// get users who haven't updated their data in the timeout period


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











		// event classes

		var ApiReadyEvent = function ApiReadyEvent() {
			this.isApiReady = apiReady_;
		}

		var AppVisibleEvent = function () {
			this.isAppVisible = appVisible_;
		}

		var EnabledParticipantsChangedEvent = function () {
			this.enabledParticipants = this.getEnabledParticipants();
		}

		var ParticipantsAddedEvent = function () {
			this.addedParticipants = addedParticipants_;
		}

		var ParticipantsChangedEvent = function () {
			this.participants = participants_;
		}

		var ParticipantsDisabledEvent = function () {
			this.disabledParticipants = disabledParticipants_;
		}

		var ParticipantsEnabledEvent = function () {
			this.enabledParticipants = this.getEnabledParticipants();
		}

		var ParticipantsRemovedEvent = function () {
			this.removedParticipants = removedParticipants_;
		}






		// public participant methods

		this.getEnabledParticipants = function () {
			var retVal = [];
			$.each(participants_, function (participantIndex, participant) {
				if (participant.hasAppEnabled) {
					retVal.push(participant);
				}
			});
			return retVal;
		}


		this.getHangoutUrl = function () {
			return "getHangoutUrl response";
		}


		this.getHangoutId = function () {
			return "getHangoutId response";
		}

		this.getLocale = function () {
			return "en-US";
		}

		this.getParticipantById = function (participantId) {
			$.each(participants_, function (participantIndex, participant) {
				if (participant.id == participantId) {
					return participant;
				}
			});
			return null;
		}

		this.getParticipantId = function () {
			return "getParticipantId response";
		}

		this.getParticipants = function () {
			return participants_;
		}

		this.hideApp = function () { }


		this.isApiReady = function () {
			return apiReady_;
		}

		this.isAppVisible = function () {
			return appVisible_;
		}





		// public participant event methods

		this.onAppVisible = new function () {
			var callbacks = [];
			this.add = function (callback) {
				callbacks.push(callback);
			}
			this.remove = function (callback) {
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
				callbacks.push(callback);
			}
			this.remove = function (callback) {
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
				callbacks.push(callback);
			}
			this.remove = function (callback) {
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
				callbacks.push(callback);
			}
			this.remove = function (callback) {
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
				callbacks.push(callback);
			}
			this.remove = function (callback) {
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
				callbacks.push(callback);
			}
			this.remove = function (callback) {
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
				callbacks.push(callback);
			}
			this.remove = function (callback) {
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
		gapi.hangout.data
		*/

		this.data = new function () {



			// private vars

			var this_ = this,
				localDelta = {
					updates: [],
					removes: [],
					timestamp: getDelta().timestamp
				};





			// private methods

			function getDelta() {

				return Storage.get("delta", {
					updates: [],
					removes: [],
					timestamp: newTimestamp()
				});
			}


			function Update() {

				var eventsToDispatch = [],
					currentTimestamp = newTimestamp(),
					delta = getDelta();



				// check if the stored delta timestamp is set later
				if (delta.timestamp > localDelta.timestamp) {


					// set local delta timestamp to stored delta's
					localDelta.timestamp = delta.timestamp;

					// go through each stored update item
					$.each(delta.updates, function (deltaUpdateItemIndex, updateItem) {



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

						var state = this_.getState(),
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
						this_.onStateChanged.trigger_(evt);
					});
				}


				var lastUserToUpdateTimestamp = currentTimestamp;

				var userDeltaTimestamps = getUserDeltaTimestamps();
				userDeltaTimestamps[USER.id] = currentTimestamp;

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

			}




			// event classes

			function StateChangedEvent(addedKeys, removedKeys) {
				this.addedKeys = addedKeys || [];
				this.metadata = this_.getStateMetadata();
				this.removedKeys = removedKeys || [];
				this.state = this_.getState();
			}





			// public methods

			this.clearValue = function (key) {
				this.submitDelta({}, [key]);
			}

			this.getKeys = function () {
				var retVal = [];
				$.each(this.getState(), function (key) {
					retVal.push(key)
				});
				return retVal;
			}

			this.getValue = function (key) {
				return this.getState()[key];
			}

			this.getState = function () {
				var state = Storage.get("state", {});
				return state;
			}

			this.getStateMetadata = function () {
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
				var delta = {};
				delta[key] = value;
				this.submitDelta(delta, []);
			}

			this.submitDelta = function (opt_updates, opt_removes) {

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



			// public events

			this.onStateChanged = new function () {
				var callbacks = [];
				this.add = function (callback) {
					callbacks.push(callback);
				}
				this.remove = function (callback) {
					callbacks.splice(callbacks.indexOf(callback), 1);
				}
				// Private method
				this.trigger_ = function (evt) {
					$.each(callbacks, function (callbackIndex, callback) {
						callback(evt);
					});
				}
			}






			// auto update

			setInterval(Update, UPDATE_RATE);


		}





	}

}