/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

// The possible return values of getTypeOf.
const VALID_TYPES = [
    'array',
    'boolean',
    'function',
    'null',
    'number',
    'object',
    'regexp',
    'string',
    'symbol',
    'undefined',
];

/**
 * Returns a validated options dictionary given some requirements.  If any of
 * the requirements are not met, an exception is thrown.
 *
 * @param  options
 *         An object, the options dictionary to validate.  It's not modified.
 *         If it's null or otherwise falsey, an empty object is assumed.
 * @param  requirements
 *         An object whose keys are the expected keys in options.  Any key in
 *         options that is not present in requirements is ignored.  Each value
 *         in requirements is itself an object describing the requirements of
 *         its key.  There are four optional keys in this object:
 *           map: A function that's passed the value of the key in options.
 *                map's return value is taken as the key's value in the final
 *                validated options, is, and ok.  If map throws an exception
 *                it's caught and discarded, and the key's value is its value in
 *                options.
 *           is:  An array containing any number of the typeof type names.  If
 *                the key's value is none of these types, it fails validation.
 *                Arrays, null and regexps are identified by the special type names
 *                "array", "null", "regexp"; "object" will not match either.  No type
 *                coercion is done.
 *           ok:  A function that's passed the key's value.  If it returns
 *                false, the value fails validation.
 *           msg: If the key's value fails validation, an exception is thrown.
 *                This string will be used as its message.  If undefined, a
 *                generic message is used, unless is is defined, in which case
 *                the message will state that the value needs to be one of the
 *                given types.
 * @return An object whose keys are those keys in requirements that are also in
 *         options and whose values are the corresponding return values of map
 *         or the corresponding values in options.  Note that any keys not
 *         shared by both requirements and options are not in the returned
 *         object.
 */
function validateOptions(options, requirements) {
    options = options || {};
    const validatedOptions = {};

    for (const key in requirements) {
        let isOptional = false;
        let mapThrew = false;
        const req = requirements[key];

        let keyInOpts = (key in options);
        let optsVal = (keyInOpts) ? options[key] : undefined;

        if ('dflt' in req && optsVal === undefined) {
            optsVal = req.dflt;
            keyInOpts = true;
        }

        if (req.map) {
            try {
                optsVal = req.map(optsVal);
            } catch (err) {
                if (err instanceof RequirementError) {
                    throw err;
                }

                mapThrew = true;
            }
        }

        if (req.is) {
            let types = req.is;

            if (!Array.isArray(types) && Array.isArray(types.is)) {
                types = types.is;
            }

            if (Array.isArray(types)) {
                isOptional = ['undefined', 'null'].every(v => !!~types.indexOf(v));

                // Sanity check the caller's type names.
                types.forEach(type => {
                    if (!~VALID_TYPES.indexOf(type)) {
                        throw new Error(`Internal error: invalid requirement type "${type}".`);
                    }
                });

                if (types.indexOf(getTypeOf(optsVal)) < 0) {
                    throw new RequirementError(key, req);
                }
            }
        }

        if (req.ok && ((!isOptional || optsVal != null) && !req.ok(optsVal))) {
            throw new RequirementError(key, req);
        }

        if (keyInOpts || (req.map && !mapThrew && optsVal !== undefined)) {
            validatedOptions[key] = optsVal;
        }
    }

    return validatedOptions;
}
exports.validateOptions = validateOptions;

// Similar to typeof, except arrays, null and regexps are identified
// by "array" and "null" and "regexp", not "object'.
function getTypeOf(value) {
    let type = typeof value;
    if (type === 'object') {
        if (!value) {
            type = 'null';
        } else if (Array.isArray(value)) {
            type = 'array';
        } else if (value instanceof RegExp) {
            type = 'regexp';
        }
    }
    return type;
}
exports.getTypeOf = getTypeOf;

function RequirementError(key, requirement) {
    Error.call(this);

    this.name = 'RequirementError';

    let msg = requirement.msg;
    if (!msg) {
        msg = `The option "${key}" `;
        msg += requirement.is ?
            'must be one of the following types: ' + requirement.is.join(', ') :
            'is invalid.';
    }
    this.message = msg;
}
RequirementError.prototype = Object.create(Error.prototype);
exports.RequirementError = RequirementError;

exports.string = {is: ['string', 'undefined', 'null']};
exports.number = {is: ['number', 'undefined', 'null']};
exports.boolean = {is: ['boolean', 'undefined', 'null']};
exports.object = {is: ['object', 'undefined', 'null']};
exports.array = {is: ['array', 'undefined', 'null']};

const isTruthyType = (type) => !(type === 'undefined' || type === 'null');
const findTypes = (v) => { while (!Array.isArray(v) && v.is) v = v.is; return v; };

function required(req) {
    const types = (findTypes(req) || VALID_TYPES).filter(isTruthyType);
    return merge({}, req, {is: types});
}
exports.required = required;

function optional(req) {
    req = merge({is: []}, req);
    req.is = findTypes(req).filter(isTruthyType).concat('undefined', 'null');
    return req;
}
exports.optional = optional;

function either(...types) {
    return union.apply(null, types.map(findTypes));
}
exports.either = either;

/**
 * Merges all the properties of all arguments into first argument. If two or
 * more argument objects have own properties with the same name, the property
 * is overridden, with precedence from right to left, implying, that properties
 * of the object on the left are overridden by a same named property of the
 * object on the right.
 *
 * Any argument given with "falsy" value - commonly `null` and `undefined` in
 * case of objects - are skipped.
 *
 * @examples
 *    var a = { bar: 0, a: 'a' }
 *    var b = merge(a, { foo: 'foo', bar: 1 }, { foo: 'bar', name: 'b' });
 *    b === a   // true
 *    b.a       // 'a'
 *    b.foo     // 'bar'
 *    b.bar     // 1
 *    b.name    // 'b'
 */
function merge(source, ...properties) {
    let descriptor = {};

    // `Boolean` converts the first parameter to a boolean value. Any object is
    // converted to `true` where `null` and `undefined` becames `false`. Therefore
    // the `filter` method will keep only objects that are defined and not null.
    for (const props of properties.filter(Boolean)) {
        const symbols = Object.getOwnPropertySymbols(props);
        const names = Object.getOwnPropertyNames(props);
        const ownPropertyIdentifiers = [...names, ...symbols];

        for (const name of ownPropertyIdentifiers) {
            descriptor[name] = Object.getOwnPropertyDescriptor(props, name);
        }
    }

    return Object.defineProperties(source, descriptor);
}

/**
 * Produce an array that contains the union: each distinct element from all
 * of the passed-in arrays.
 */
function union(...arrays) {
    const combined = [].concat.apply(...arrays);

    // slower option:
    // return [...new Set(combined)];

    return combined.reduce((result, item) => {
        if (!~result.indexOf(item)) {
            result.push(item);
        }

        return result;
    }, []);
}
