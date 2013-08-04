
// Get the username in the URL
var user = window.location.search.match(/user=([^&]+)/);

var lastFMAPIKey = "74a96d850875a94cc89e725d7cd0c3d1";

// If an username is present
if (user && user.length > 1) {
	user = user[1];

	// Change the title of the document
	document.title = user+"'s albums stack";
	var title = document.getElementById("title");
	title.firstChild.data = "'s albums stack";
	var a = document.createElement("a");
	a.href = ".";
	a.appendChild(document.createTextNode(user));
	title.insertBefore(a, title.firstChild);

	// Hide the username form
	document.getElementById("userform").style.display = "none";

	// Create a loading text information
	var loading = document.createElement("p");
	loading.className = "loading";
	loading.appendChild(document.createTextNode("loading..."));
	document.body.appendChild(loading);

	// Load his albums collection (for the last year)
	loadJSONP("http://ws.audioscrobbler.com/2.0/?method=library.getalbums&api_key="+lastFMAPIKey+
		"&user="+user+"&format=json&limit=256&period=12month&callback=retrieveAlbums");

	// Load his last listenings
	loadJSONP("http://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&api_key="+lastFMAPIKey+
		"&user="+user+"&format=json&limit=200&callback=retrieveTracks");
}

// Very small JSONP load function, I'm lazy
function loadJSONP(url) {
	var script = document.createElement("script");
	script.type="text/javascript";
	script.src = url;
	document.body.appendChild(script);
}

// The Last.FM JSON is weird for images links
// Get an image by a size
function getImageURL(image, size) {
	// For each images
	for (var i = 0, l = image.length; i < l; ++i) {

		// If the size correspond
		if (image[i].size == size) {
			return image[i]["#text"];
		}
	}

	// If no size is in the collection, get the bigger one (the last)
	return image[l-1]["#text"];
}

// Collections
var albums = {},
	tracks = {};

// List of images to show (lazy load images)
var imgToLoad = [];

// His the albums and the tracks are loaded
var albumsLoaded = false,
	tracksLoaded = false;

// JSON-P callback  for albums
function retrieveAlbums(data) {
	if (!data.albums) {
		alert("Unable to retrieve albums : " + data.message);
	} else {
		albums = data.albums;
		albumsLoaded = true;
		load();
	}
}

// JSON-P callback for tracks
function retrieveTracks(data) {
	if (!data.recenttracks) {
		alert("Unable to retrieve tracks : "+data.message);
	} else {
		tracks = data.recenttracks;
		tracksLoaded = true;
		load();
	}
}

// When a new content is loaded
function load() {
	// If all the data is not loaded
	if (!albumsLoaded || !tracksLoaded) {
		return;
	}

	// If the stack is empty, inform the user
	if (!tracks.track || !albums.album) {

		// Use the loading element, I'm lazy
		loading.firstChild.data = "The stack is empty";
		return;
	}

	// Hide the loading message
	loading.style.display = 'none';

	var albumsPositions = {}, // <albumKey, albumPositionInTracks>
		albumsTracksCpt = {}, // <albumKey, cptListennings>
		displayedAlbums = {}, // <albumKey, true>
		currentPosition = 1, // currentPosition for albumsPositions
		i, l, album, key, artistName; // often used variables


	// For each tracks
	// We use the tracks list to get some albums which are not 
	// in the top, but which are currently listenned by the user
	for (i = 0, l = tracks.track.length; i < l; ++i) {
		album = tracks.track[i].album;
		artistName = tracks.track[i].artist["#text"];
	
		// Some albums don't have a mbid, so use the name as key
		key = artistName + " - "+album["#text"];

		// If it's the first time we see this album
		if (!albumsPositions.hasOwnProperty(key)) {
			// Register it
			albumsPositions[key] = currentPosition++;
			albumsTracksCpt[key] = 1;
		} else {

			// If it's more than 3 listennings, we can consider
			// that the album is in the stack and this is not
			// just a tracks from a radio or whatever
			if (++albumsTracksCpt[key] === 3) {
				// Create a album object similar to the retreiveAlbums API
				album.name = album["#text"];
				album.mbid = key;
				album.image = tracks.track[i].image;
				album.artist = {name: tracks.track[i].artist["#text"]};

				// Add this new album to the album list
				albums.album.push(album);
			}
		} 
	}

	// Sort the list
	albums.album.sort(function (a, b) {

		var posA = albumsPositions[a.mbid],
			posB = albumsPositions[b.mbid];

		// Last played in first
		if (posA) {
			if (posB) {
				return posA - posB;
			}
			return -1;
		} else if (posB) {
			return 1;
		}

		// If the album is not the last played, most played in first
		return parseInt(b.playcount) - parseInt(a.playcount);
	});

	// For each albums
	for (i = 0, l = albums.album.length; i < l; ++i) {

		album = albums.album[i];

		// Some albums don't have a mbid, so use the name as key
		key = album.artist.name + " - " + album.name;

		// If the album is already displayed, ignore it the second time
		if (displayedAlbums.hasOwnProperty(key)) {
			continue;
		}

		displayedAlbums[key] = true;

		var title = album.name + " - " + album.artist.name;

		// Create the link
		var a = document.createElement("a");
		a.className = "album";

		// Use a spotify search because I can't get the direct URI from Last.FM
		a.setAttribute("href", "spotify:search:"+escape(album.artist.name) + "%20" + escape(album.name));

		// Create the album cover
		var img = document.createElement("img");

		var src = getImageURL(album.image, "extralarge");
		img.setAttribute("data-src", src);


		img.setAttribute("alt", title);

		// If the src is empty, don't add an image element
		if (src) {
			a.appendChild(img);

			// Register the image to load
			imgToLoad.push(img);
		}

		// Create the title
		var h3 = document.createElement("h3");
		h3.appendChild(document.createTextNode(title));

		a.appendChild(h3);

		// Add the album
		document.body.appendChild(a);

	}

	adaptWidth();
	loadImages();
}

// Lazy image load
function loadImages() {

	// Get the current scroll position
	var startLoadPosition = window.scrollY + window.innerHeight;

	// For each images to load
	for (var i = 0, l = imgToLoad.length, cptUseless = 0; i < l; ++i) {
		var img = imgToLoad[i];

		// If the image still exist
		if (img) {
			// If the image is visible
			if (img.parentNode && img.parentNode.offsetTop < startLoadPosition) {

				// Set the src attribute from the data-src attribute
				img.setAttribute("src", img.getAttribute("data-src"));
				img.removeAttribute("data-src");

				imgToLoad[i] = null;
				++cptUseless;
			} 
		} else {
			++cptUseless;
		}
	}

	// If the imgToLoad array contain more than sixteen useless image
	// Create a new array without them
	if (cptUseless > 16) {
		var newTab = [];
		for (i = 0; i < l; ++i) {
			if (imgToLoad[i]) {
				newTab.push(imgToLoad[i]);
			}
		}

		imgToLoad = newTab;
	}
}

// Response design in JavaScript (mouhahahhahaha)
var currentWidth = -1;
function adaptWidth() {
	var width = window.innerWidth;

	// Mouhhahah too
	if (width == currentWidth) {
		// Because the scroll events are often in double
		return;
	}

	// Size of an album cover
	var size = parseInt((width-40)/(parseInt((width-20)/320.0)+1))-20;

	// For each albums
	var albums = document.getElementsByClassName("album");
	for (var i = 0, l = albums.length; i < l; ++i) {
		var album = albums[i];
		// Set the new size
		album.style.width = size+'px';
		album.style.height = size+'px';
	}
}

// Some ugly event listeners
window.onscroll = loadImages;
window.onresize = function() {
	adaptWidth();
	loadImages();
}