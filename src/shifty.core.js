/*global setTimeout:true, clearTimeout:true */

/**
Shifty - A teeny tiny tweening engine in JavaScript. 
By Jeremy Kahn - jeremyckahn@gmail.com
  v0.1.0

For instructions on how to use Shifty, please consult the README: https://github.com/jeremyckahn/tweeny/blob/master/README.md

MIT Lincense.  This code free to use, modify, distribute and enjoy.

*/

(function Shifty (global) {
	
	/**
	 * Get the current UNIX epoch time as an integer.  Exposed publicly as `Tweenable.util.now()`.
	 * @returns {Number} An integer representing the current timestamp.
	 */
	function now () {
		return +new Date();
	}
	
	/**
	 * Handy shortcut for doing a for-in loop.  Takes care of all of the `hasOwnProperty` wizardry for you.  This also exposed publicly, external code can access it as `Tweenable.util.each()`.
	 * @param {Object} obj The object to iterate through.
	 * @param {Function} func The function to pass the object and "own" property to.  This handler function receives the `obj` back as the first parameter, and a property name as the second.
	 */
	function each (obj, func) {
		var prop;
		
		for (prop in obj) {
			if (obj.hasOwnProperty(prop)) {
				func(obj, prop);
			}
		}
	}
	
	/**
	 * Does a basic copy of one Object's properties to another.  This is not a robust `extend` function, nor is it recusrsive.  It is only appropriate to use on objects that have primitive properties (Numbers, Strings, Boolean, etc.).  Exposed publicly as `Tweenable.util.simpleCopy()`
	 * @param {Object} targetObject The object to copy into
	 * @param {Object} srcObject The object to copy from
	 * @returns {Object} A reference to the augmented `targetObj` Object
	 */
	function simpleCopy (targetObj, srcObj) {
		each(srcObj, function (srcObj, prop) {
			targetObj[prop] = srcObj[prop];
		});
		
		return targetObj;
	}
	
	/**
	 * Calculates the interpolated tween values of an Object based on the current time.
	 * @param {Number} currentTime The current time to evaluate the tween against.
	 * @param {Object} params A configuration Object containing the values that this function requires.  The required properties in this Object are:
	 *   @property {Object} originalState The original properties the Object is tweening from.
	 *   @property {Object} to The destination properties the Object is tweening to.
	 *   @property {Number} duration The length of the tween in milliseconds.
	 *   @property {Number} timestamp The UNIX epoch time at which the tween began.
	 *   @property {Function} easingFunc The function used to calculate the tween.  See the documentation for `Tweenable.prototype.formula` for more info on the appropriate function signature for this.
	 * @param {Object} state A configuration object containing current state data of the tween.  Required properties:
	 *   @property {Object} current The Object containing the current `Number` values of the tween.
	 */
	function tweenProps (currentTime, params, state) {
		var prop;
		
		for (prop in state.current) {
			if (state.current.hasOwnProperty(prop) && params.to.hasOwnProperty(prop)) {
				state.current[prop] = params.easingFunc(currentTime - params.timestamp, params.originalState[prop], params.to[prop] - params.originalState[prop], params.duration);
			}
		}
	}
	
	function scheduleUpdate (handler, fps) {
		return setTimeout(handler, 1000 / fps);
	}
	
	/**
	 * Calls all of the functions bound to a specified hook on a `Tweenable` instance.
	 * @param {String} hookName The name of the hook to invoke the handlers of.
	 * @param {Object} hooks The object containing the hook Arrays.
	 * @param {Object} applyTo The `Tweenable` instance to call the hooks upon.
	 * @param {Array} args The arguments to pass to each function in the specified hook.
	 */
	function invokeHook (hookName, hooks, applyTo, args) {
		var i;
		
		for (i = 0; i < hooks[hookName].length; i++) {
			hooks[hookName][i].apply(applyTo, args);
		}
	}
	
	/**
	 * Applies a Shifty filter to `Tweenable` instance.
	 * @param {String} filterName The name of the filter to apply.
	 * @param {Object} applyTo The `Tweenable` instance to call the filter upon.
	 * @param {Array} args The arguments to pass to the function in the specified filter.
	 */
	function applyFilter (filterName, applyTo, args) {
		each(global.Tweenable.prototype.filter, function (filters, name) {
			if (filters[name][filterName]) {
				filters[name][filterName].apply(applyTo, args);
			}
		});
	}
	
	/**
	 * Handles the update logic for one step of a tween.
	 * @param {Object} params The configuration containing all of a tween's properties.  This requires all of the `params` @properties required for `tweenProps`, so see that.  It also requires:
	 *   @property {Object} owner The `Tweenable` instance that the tween this function is acting upon belongs to.
	 *   @property {Object} hook The Object containing all of the `hook`s that belong to `owner
	 * @param {Object} state The configuration Object containing all of the state properties for a `Tweenable` instance.  It requires all of the @properties listed for the `state` parameter of  `tweenProps`, so see that.  It also requires:
	 *   @property {Boolean} isAnimating Whether or not this tween as actually running.
	 *   @property {Number} loopId The property that the latest `setTimeout` invokation ID stored in.
	 */
	function timeoutHandler (params, state) {
		var currentTime;
		
		currentTime = now();
		
		if (currentTime < params.timestamp + params.duration && state.isAnimating) {
			applyFilter('beforeTween', params.owner, [state.current, params.originalState, params.to]);
			tweenProps (currentTime, params, state);		
			applyFilter('afterTween', params.owner, [state.current, params.originalState, params.to]);
			
			if (params.hook.step) {
				invokeHook('step', params.hook, params.owner, [state.current]);
			}
			
			params.step.call(state.current);
			
			// The tween is still running, schedule an update
			state.loopId = scheduleUpdate(function () {
				timeoutHandler(params, state);
			}, params.fps);
		} else {
			// The duration of the tween has expired
			params.tweenController.stop(true);
		}
	}
	
	function Tween (params, state) {
		/**
		 * Stops and cancels the tween.
		 * @param {Boolean} gotoEnd If `false`, or omitted, the tween just stops at its current state, and the `callback` is not invoked.  If `true`, the tweened object's values are instantly set the the target "to" values, and the `callback` is invoked.
		 * @returns {Object} The `Tween` instance for chaining.
		 */
		this.stop = function stop (gotoEnd) {
			clearTimeout(state.loopId);
			if (gotoEnd) {
				simpleCopy(state.current, params.to);
				state.isAnimating = false;
				params.callback.call(state.current);
			}
			
			return this;
		};
		
		/**
		 * Pauses a tween.  A `pause`d tween can be resumed with `resume()`.
		 * @returns {Object} The `Tween` instance for chaining.
		 */
		this.pause = function pause () {
			clearTimeout(state.loopId);
			state.pausedAtTime = now();
			state.isPaused = true;
			return this;
		};
		
		/**
		 * Resumes a paused tween.  A tween must be `pause`d before is can be `resume`d.
		 * @returns {Object} The `Tween` instance for chaining.
		 */
		this.resume = function play () {
			if (state.isPaused) {
				params.timestamp += state.pausedAtTime - params.timestamp;
			}
			
			scheduleUpdate(function () {
				timeoutHandler(params, state);
			});
			
			return this;
		};
		
		/**
		 * Returns a reference to the tweened Object's current state (the `from` Object that wat passed to `tweenableInst.tween()`).
		 * @returns {Object}
		 */
		this.get = function get () {
			return state.current;
		};
		
		return this;
	}
	
	function Tweenable () {
		
		/**
		 * Prepares a `Tweenable` instance for use.  This method basically just initializes all of the properties that a `Tweenable` instance will need.
		 * @param {Object} options A configuration Object containing options for the `Tweenable` instance.  The following are valid:
		 *   @property {Number} fps The frame rate (frames per second) at which the instance will update.  Default is 30.
		 *   @property {String} easing The name of the default easing formula (attached to `Tweenable.prototype.formula`) to use for each `tween` made for this instance.  Default is `linear`.
		 *   @property {Number} duration The default `duration` for each `tween` for this instance.  Default is 500 milliseconds.
		 * returns {Object} `Tweenable` instance for chaining.
		 */
		this.init = function init (options) {
			options = options || {};
			
			this._hook = {};

			this._tweenParams = {
				owner: this,
				hook: this._hook
			};

			this._state = {};

			// The framerate at which Shifty updates.
			this.fps = options.fps || 30;

			// The default easing formula.  This can be changed publicly.
			this.easing = options.easing || 'linear';

			// The default `duration`.  This can be changed publicly.
			this.duration = options.duration || 500;
			
			return this;
		};
		
		/**
		 * @param {Object} from 
		 * @param {Object} to
		 * @param {Number} duration
		 * @param {String} easing
		 */
		this.tween = function tween (from, to, duration, callback, easing) {
			var self;
			
			if (this._state.isAnimating) {
				return;
			}
				
			self = this;
			this._state.loopId = 0;
			this._state.current = {};
			this._state.pausedAtTime = null;
			
			// Normalize some internal values depending on how `Tweenable.tween` was invoked
			if (to) {
				// Assume the shorthand syntax is being used.
				this._tweenParams.step = function () {};
				this._state.current = from || {};
				this._tweenParams.to = to || {};
				this._tweenParams.duration = duration || this.duration;
				this._tweenParams.callback = callback || function () {};
				this._tweenParams.easing = easing || this.easing;
			} else {
				// If the second argument is not present, assume the longhand syntax is being used.
				this._tweenParams.step = from.step || function () {};
				this._tweenParams.callback = from.callback || function () {};
				this._state.current = from.from || {};
				this._tweenParams.to = from.to || {};
				this._tweenParams.duration = from.duration || this.duration;
				this._tweenParams.easing = from.easing || this.easing;
			}
			
			this._tweenParams.timestamp = now();
			this._tweenParams.easingFunc = this.formula[this._tweenParams.easing] || this.formula.linear;
			this._tweenParams.originalState = simpleCopy({}, this._state.current);
			applyFilter('tweenCreated', this._tweenParams.owner, [this._state.current, this._tweenParams.originalState, this._tweenParams.to]);
			this._tweenParams.tweenController = new Tween(this._tweenParams, this._state);
			this._state.isAnimating = true;

			scheduleUpdate(function () {
				timeoutHandler(self._tweenParams, self._state);
			}, this.fps);
			
			return this._tweenParams.tweenController;
		};
		
		this.hookAdd = function hookAdd (hookName, hookFunc) {
			if (!this._hook.hasOwnProperty(hookName)) {
				this._hook[hookName] = [];
			}
			
			this._hook[hookName].push(hookFunc);
		};
		
		this.hookRemove = function hookRemove (hookName, hookFunc) {
			var i;
			
			if (!this._hook.hasOwnProperty(hookName)) {
				return;
			}
			
			if (!hookFunc) {
				this._hook[hookName] = [];
				return;
			}
			
			for (i = this._hook[hookName].length; i >= 0; i++) {
				if (this._hook[hookName][i] === hookFunc) {
					this._hook[hookName].splice(i, 1);
				}
			}
		};
		
		return this;
	}
	
	Tweenable.prototype.filter = {};
	Tweenable.util = {
		'now': now
		,'each': each
		,'simpleCopy': simpleCopy
	};
	
	/**
	 * This object contains all of the tweens available to Tweeny.  It is extendable - simply attach properties to the Tweenable.prototype.formula Object following the same format at `linear`.
	 * 
	 * This pattern was copied from Robert Penner, under BSD License (http://www.robertpenner.com/)
	 * 
	 * @param t The current time
	 * @param b Start value
	 * @param c Change in value (delta)
	 * @param d Duration of the tween
	 */
	Tweenable.prototype.formula = {
		linear: function (t, b, c, d) {
			// no easing, no acceleration
			return c * t / d + b;
		}
	};
	
	global.Tweenable = Tweenable;
	
}(this));