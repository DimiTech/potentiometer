(function(global) {

	"use strict";

	// The constructor function
	function Potentiometer(options) {
		/* We can't load more than one widget at a time,
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
				getCenter(self);

				// Position, from 0 to 100
				self.position = 50;
				// Last position is used to make the knob not jump from 0 to 100 and vice-versa
				self.lastPosition = self.position;

				drawKnob(self);

				setUpMouseListeners(self);

				// Recalculate centers when window resizes
				global.addEventListener('resize', function() {
					getCenter(self);
				});

				/* ------------ Interface methods ------------ */

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

				/* ------------------------------------------ */

				// We've finished loading the widget, let others know that they can load
				global.loadingPotentiometer = false;
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

	function drawKnob(self) {
		var percent = self.position;
		// Dont allow values less than 0 and greater than 100
		if (percent < self.leftBound)
			percent = self.leftBound;
		else if (percent > self.rightBound)
			percent = self.rightBound;

		percent = percent / 100;

		var yPos = getYPos(percent, self);

		// 'Cap' the position property
		self.position = ~~(( ~~((percent * 100) - self.leftBound) / (self.rightBound - self.leftBound) ) * 100);

		// Don't allow big jumps in knob values
		if (self.lastPosition - self.position < 50 && self.lastPosition - self.position > -50) {
			// Draw on the canvas
			var context = self.context;
			context.clearRect(0, 0, context.width, context.height);
			context.drawImage(self.spritesheet, 0, yPos);

			self.lastPosition = self.position;
		} else {
			self.position = self.lastPosition;
		}
		
	}

	// Calculate the spritesheet y offset value
	function getYPos(percent, self) {
		var yPos = - (~~(percent * self.numberOfSprites) * self.spritesheet.width);

		// Check the left bound
		if (yPos >  - ~~((self.leftBound / 100) * self.numberOfSprites) * self.spritesheet.width)
			yPos = - ~~((self.leftBound / 100) * self.numberOfSprites) * self.spritesheet.width;
		// Check the right
		else if (yPos <  - ~~((self.rightBound / 100) * self.numberOfSprites) * self.spritesheet.width)
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
				drawKnob(self);

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

	// Make the constructor available in the global scope
	global.Potentiometer = Potentiometer;

})(window);