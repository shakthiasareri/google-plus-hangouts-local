A base project that provides a fast workflow for developing Google+ Hangout applications. The idea is that you can work locally on a hangouts application and still have all the events and methods work.

This way to update a live hangout you would just need to copy the Application Javascript file if there are code changes and the User Interface HTML file for UI changes.

The project contains:

  * Standalone HTML file for user interface
  * Proxy page that is used to load it into the Google+ Hangouts interface (using JSONP)
  * Live and Local Bootstrap Javascript file for loading resources
  * Abstracted Application Javascript file
  * Emulation of Hangouts Javascript file


Currently the project can handle **Participants** and **Data** (except processing removed keys)