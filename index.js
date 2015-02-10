'use strict';

function noop() {
	return '';
}

function getStack(context) {
	return context._layoutStack || (context._layoutStack = []);
}


function getParentFromContext(context){
	return context._parentContext ||null;
}
function getIsContextEmbed(context){
	return context._isEmebed || false;

}
function getIsContextRoot(context){
	var parent = getParentFromContext(context)
	if(parent === null){
		return false;

	}else if (parent._name != undefined) {
		return false
	}
	return true
}


function getNextTemplateContext(context){

	//if current context template
	if(!getIsContextEmbed(context)){
		return context;
	}
	//Root is emebd not template
	else if(getIsContextRoot(context) && getIsContextEmbed(context)){
		return context;
	}
	//If we on top of the tree and not
	else if(getIsContextRoot(context)){
		throw new Error ("No next context can resolved"  + JSON.stringify(context))
	}

	//Search recursive
	var parent = getParentFromContext(context)
	if(!getIsContextEmbed(context)){
		return parent;
	}
	else {
		return getNextTemplateContext(parent)
	}
}

function initActions(context) {
	var stack = getStack(context),
		actions = {};

	context._layoutActions = actions;

	while (stack.length) {
		stack.pop()(context);
	}

	return actions;
}

function getActions(context) {
	return context._layoutActions || initActions(context);
}

function getActionsByName(context, name) {
	var actions = getActions(context);

	return actions[name] || (actions[name] = []);
}

function applyAction(val, action) {
	/* jshint validthis:true */

	switch (action.mode) {
		case 'append': {
			return val + action.fn(this);
		}

		case 'prepend': {
			return action.fn(this) + val;
		}

		case 'replace': {
			return action.fn(this);
		}

		default: {
			return val;
		}
	}
}

function mixin(target) {
	var arg, key,
		len = arguments.length,
		i = 1;

	for (; i < len; i++) {
		arg = arguments[i];

		if (!arg) {
			continue;
		}

		for (key in arg) {
			/* istanbul ignore else */
			if (arg.hasOwnProperty(key)) {
				target[key] = arg[key];
			}
		}
	}

	return target;
}

/**
 * Registers layout helpers on an instance of Handlebars.
 *
 * @type {Function}
 * @param {Object} handlebars Handlebars instance.
 * @return {Object} Handlebars instance.
 */
function layouts(handlebars) {
	var helpers = {
		/**
		 * @method extend
		 * @param {String} name
		 * @param {Object} options
		 * @param {Function(Object)} options.fn
		 * @param {Object} options.hash
		 * @param {boolean} options.isEmbed - if the extend is called from a emebd
		 * @return {String} Rendered partial.
		 */
		extend: function (name, options) {
			options = options || {};
			var fn = options.fn || noop,
				context = Object.create(this || {}),
				template = handlebars.partials[name],
				isEmbed = options.isEmbed

			// Mix attributes into context
			mixin(context, options.hash);

			// Partial template required
			if (template == null) {
				throw new Error('Missing partial: \'' + name + '\'');
			}

			// Compile partial, if needed
			if (typeof template !== 'function') {
				template = handlebars.compile(template);
			}


			// Add overrides to stack
			getStack(context).push(fn);
			context._isEmebed = isEmbed;

			if(isEmbed==true){
				context._parentContext = options.parentContext;
			}else {
				context._parentContext = this;
			}
			context._name = name;

			// Render partial
			return template(context);
		},

		/**
		 * @method embed
		 * @return {String} Rendered partial.
		 */
		embed: function (name, options) {
			var context = Object.create(this || {});
			var options = options ||{}
			var hash = options.hash ||{}
			var proxyActions = hash.proxyActions  ||false;
			// Reset context
			context._layoutStack = null;
			context._layoutActions = null;



			//If embed execute the template and remember the template
			options.isEmbed = true;
			options.parentContext = this;

			// Extend
			return helpers.extend.call(context, name, options);
		},

		/**
		 * @method block
		 * @param {String} name
		 * @param {Object} options
		 * @param {Function(Object)} options.fn
		 * @param {boolean} options.hash.searchRecursiveForActions
		 * @param {boolean} [options.hash.searchRecursiveForActionsDepth=1]
		 * @return {String} Modified block content.
		 */
		block: function (name, options) {
			options = options || {};

			var fn = options.fn || noop,
				context = this || {},
				hash = options.hash || {},
				searchRecursiveForActions = hash.searchRecursiveForActions || false,
				searchRecursiveForActionsDepth = hash.searchRecursiveForActionsDepth || 1;


			/**
			 * Search in the parent contexts for actions with the name
			 * NOTICE: May performace issues with a hight searchRecursiveForActionsDepth
			 */
			if(searchRecursiveForActions){
				var nextContext;
				for(var i = 0; i<searchRecursiveForActionsDepth; i++){
					nextContext = getParentFromContext(context);
					//Break if on top of tree
					if(nextContext == null ){
						break;
					}
					var actions = getActionsByName(nextContext,name);
					if(actions.length > 0 ){
						context = nextContext;
					}

				}


			}


			return getActionsByName(context, name).reduce(
				applyAction.bind(context),
				fn(context)
			);
		},

		/**
		 * @method content
		 * @param {String} name
		 * @param {Object} options
		 * @param {Function(Object)} options.fn
		 * @param {Object} options.hash
		 * @param {String} options.hash.mode
		 * @return {String} Always empty.
		 */
		content: function (name, options) {
			options = options || {};

			var fn = options.fn || noop,
				hash = options.hash || {},
				mode = hash.mode || 'replace',
				context = this || {};

			getActionsByName(context, name).push({
				mode: mode.toLowerCase(),
				fn: fn
			});

			return '';
		}
	};

	handlebars.registerHelper(helpers);

	return handlebars;
}

/**
 * Assemble-compatible register method.
 *
 * @method register
 * @param {Object} handlebars Handlebars instance.
 * @return {Object} Handlebars instance.
 * @static
 */
layouts.register = layouts;

module.exports = layouts;
