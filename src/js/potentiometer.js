(function(global) {

	"use strict";

	// The constructor function
	function Potentiometer(options) {
		/* We can't load more than one widget at a time because of some async issues,
		/* so we need a global flag to signify when one widget is done loading */
		if (global.loadingPotentiometer !== undefined)
			global.loadingPotentiometer = true;
		else
			global.loadingPotentiometer = false;

		var self = this;
		
		initializeWidget(self, options);
		
	}

	function initializeWidget(self, options) {
		
		/* if no other potentiometer widget is currently lading then load the widget,
		/* if a potentiometer widget is loading wait a little (10ms) and then load */
		if (global.loadingPotentiometer === false) {

			self.center = { x: 0, y: 0 }; // center of the widget, used for calculations
			self.canvas = options.canvas;

			// the entire spritesheet
			self.spritesheet = new Image();
			self.spritesheet.src = options.spritesheetUrl;

			// set bounds
			self.leftBound  = options.leftBound  || 0;
			self.rightBound = options.rightBound || 100;

			// if bounds are incorrectly set throw an error
			if (self.leftBound >= self.rightBound)
				throw new Error('Left bound must be lower then the rigth bound');

			self.spritesheet.onload = function() {
				setUpCanvas(self);
				setUpContext(self);
				countSprites(self);

				/**
				*	Ok, so why is this 10ms timeout here? Here's the explanation:
				*	In the setUpCanvas() function above we change each canvas' width and height.
				*   Then we get to the getCenter() function with gets the center coordinates of our canvas elements.
				*
				*	The problem begins when we have many canvas elements, which when are put on a page like this: '<canvas id="widget1"></canvas>',
				*	with no width and height attributes (which is a legit canvas to use this widget on). 
				*   In that case they take their default width and height on the page (300x150 on Chrome). 
				*
				*   We don't have a problem with height, since no matter how much the height of the element is changed, it's offsetTop attribute will stay the same.
				*	We have a problem with width because widgets load in random order!
				*
				*	Here's how the problem occurs:
				*	Let's say we have 3 canvas elements and we instantiate this widget on all 3 of them. Canvases are all next to each other (left to right),
				*	and have no space between them and are going to be set to the same width when instantiated. Their widths by default (in Chrome) are 300px. 
				*	In total, they all take 900px of horizontal space before instantiation.
				*
				*	Now we instantiate the potentiometer widgets.
				*	Widget 1 (on canvas1) instantiates normally. It's canvas' width and height are adjusted accordingly (let's say to 50x50 px) and everything's fine.
				*	Widget 3 (on canvas3) begins to load. It calculates it's center based on it's canvas' location on the page.
				*	canvas3 has the offsetLeft property of 350 (canvas1.width + canvas2.width = 50 + 300). But when the Widget 2 loads after this that offset value won't be correct.
				* 	It should be 100px after all 3 widgets load (canvas1.width + canvas2.width = 50 + 50), which isn't the case.
				*
				*	This timeout here ensures that all of our widgets on the page have their widths properly adjusted before calculating centers of each one of them.
				*
				*	(this is probably the longest comment I've ever written in my life so far :) )
				*/
				setTimeout(function() {

					getCenter(self);

					// Position (the potentiometer value) = integers from 0 to 100
					self.position = 50;
					// Last position is used to make the knob not jump from 0 to 100 and vice-versa
					self.lastPosition = self.position;

					drawKnob(self);

					setUpMouseListeners(self);

					// Recalculate centers when window resizes
					global.addEventListener('resize', function() {
						getCenter(self);
					});

					addInterfaceMethods(self);

					// We've finished loading the widget, let others know that they can load
					global.loadingPotentiometer = false;

				}, 10);

			};

		} else {
			setTimeout(function() {
				initializeWidget(self, options);
			}, 10);
		}

	}

	function setUpCanvas(self) {
		// sprite dimensions are x * x
		self.canvas.height = self.spritesheet.width;
		self.canvas.width  = self.spritesheet.width;
	}

	// set up canvas context on which we will draw on
	function setUpContext(self) {
		self.context = self.canvas.getContext('2d');
	}

	function countSprites(self) {
	 	self.numberOfSprites = self.spritesheet.height / self.spritesheet.width;
	}

	function getCenter(self) {
		self.center.x = self.canvas.offsetLeft + (self.canvas.width / 2);
		self.center.y = self.canvas.offsetTop  + (self.canvas.height / 2);
	}

	function drawKnob(self, isMouseEvent) {
		var percent = self.position;
		// Don't allow values less than 0 and greater than 100
		if (percent < self.leftBound)
			percent = self.leftBound;
		else if (percent > self.rightBound)
			percent = self.rightBound;

		percent = percent / 100;

		var yPos = getYPos(percent, self);

		// Limit the position property
		self.position = ~~(( ~~((percent * 100) - self.leftBound) / (self.rightBound - self.leftBound) ) * 100);

		// Don't allow big jumps in knob values when manipulating the knob with a mouse
		if (isMouseEvent) {

			if (self.lastPosition - self.position < 50 && self.lastPosition - self.position > -50)
				drawOnCanvas(self, yPos);
			else
				self.position = self.lastPosition;

		} else {
			drawOnCanvas(self, yPos);
		}

		function drawOnCanvas(self, yPos) {
			var context = self.context;
			context.clearRect(0, 0, context.width, context.height);
			context.drawImage(self.spritesheet, 0, yPos);

			self.lastPosition = self.position;
		}
		
	}

	// Calculate the spritesheet y offset value
	function getYPos(percent, self) {
		var yPos = - (~~(percent * self.numberOfSprites) * self.spritesheet.width);

		// Check the left bound
		if (yPos > - ~~((self.leftBound / 100) * self.numberOfSprites) * self.spritesheet.width)
			yPos = - ~~((self.leftBound / 100) * self.numberOfSprites) * self.spritesheet.width;
		// Check the right
		else if (yPos < - ~~((self.rightBound / 100) * self.numberOfSprites) * self.spritesheet.width)
			yPos = - ~~((self.rightBound / 100) * self.numberOfSprites) * self.spritesheet.width;

		return yPos;
	}

	function setUpMouseListeners(self) {

		self.isMouseDown = false;
		var xDist, yDist, totalDist, arc;
		var thisContext = self.context; // Context of the canvas that's been clicked on

		self.canvas.onmousedown = function(event) {
			xDist =  (event.pageX - self.center.x);
			yDist = -(event.pageY - self.center.y);
			totalDist = Math.sqrt(xDist * xDist + yDist * yDist);

			if (totalDist > (self.canvas.width / 2))
				self.isMouseDown = false;
			else {
				self.isMouseDown = true;
				updateKnob(self, event);
			}

			

			document.onmouseup   = function(event) { self.isMouseDown = false; };

			document.onmousemove = function(event) {
				updateKnob(self, event);
			};
		};

		function updateKnob(self, event) {
			if (self.isMouseDown) {

				xDist =  (event.pageX - self.center.x);
				yDist = -(event.pageY - self.center.y);

				arc = (Math.atan2(xDist, yDist) / Math.PI) / 2;

				// Set the position property
				self.position = ~~(101 * (arc) + 50);
				drawKnob(self, true);

				triggerEvents(self);

				// statistics, for testing purposes 
				//TODO: delete this in the production version
				document.getElementById('cursorInfo').innerHTML = 'x dist: '   + xDist + '<br>' +
																  'y dist: '   + yDist + '<br>' +
																  'arc: '      + arc   + '<br>' +
																  'position: ' + self.position;
			}
		}

		function triggerEvents(self) {
			// create a custom event
			var valueChangeEvent = document.createEvent('Event');

			// define that the event name is 'potValueChanged'.
			valueChangeEvent.initEvent('potValueChanged', true, true);

			// make the pot value available to the listener
			valueChangeEvent.srcValue = self.position;

			// target can be any Element or other EventTarget.
			self.canvas.dispatchEvent(valueChangeEvent);
		}

	}

	/* --------------- Interface methods --------------- */
	function addInterfaceMethods(self) {

		self.getValue = function() {
			return self.position;
		};

		self.setValue = function(position) {
			position = ~~position;
			if (position > 100) position = 100;
			else if (position < 0) position = 0;

			self.position = position;
			drawKnob(self);
		};

	}

	// Make the constructor available in the global scope
	global.Potentiometer = Potentiometer;

})(window);