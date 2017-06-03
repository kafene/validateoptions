/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

const vo = require('../src/validateoptions');

exports.testValidateOptionsEmpty = function (test) {
    let val;

    val = vo.validateOptions(null, {});
    test.deepEqual(val, {});

    val = vo.validateOptions(null, {foo: {}});
    test.deepEqual(val, {});

    val = vo.validateOptions({}, {});
    test.deepEqual(val, {});

    val = vo.validateOptions({}, {foo: {}});
    test.deepEqual(val, {});

    test.done();
};

exports.testValidateOptionsNonempty = function (test) {
    let val;

    val = vo.validateOptions({ foo: 123 }, {});
    test.deepEqual(val, {});

    val = vo.validateOptions({foo: 123, bar: 456}, {foo: {}, bar: {}, baz: {}});
    test.deepEqual(val, {foo: 123, bar: 456});

    test.done();
};

exports.testValidateOptionsMap = function (test) {
    let val = vo.validateOptions({foo: 3, bar: 2}, {
        foo: {map: v => v * v},
        bar: {map: v => undefined},
    });

    test.deepEqual(val, {foo: 9, bar: undefined});

    test.done();
};

exports.testValidateOptionsMapException = function (test) {
    let val = vo.validateOptions({foo: 3}, {
        foo: {map: function () { throw new Error(); }}
    });

    test.deepEqual(val, {foo: 3});

    test.done();
};

exports.testValidateOptionsOk = function (test) {
    let val = vo.validateOptions({foo: 3, bar: 2, baz: 1}, {
        foo: { ok: v => v },
        bar: { ok: v => v },
    });

    test.deepEqual(val, {foo: 3, bar: 2});

    test.throws(
        () => vo.validateOptions({foo: 2, bar: 2}, {bar: {ok: v => v > 2}}),
        /^The option "bar" is invalid/,
        "ok should raise exception on invalid option"
    );

    test.throws(
        () => vo.validateOptions(null, {foo: {ok: v => v}}),
        /^The option "foo" is invalid/,
        "ok should raise exception on invalid option"
    );

    test.done();
};

exports.testValidateOptionsIs = function (test) {
    const opts = {
        array:   [],
        boolean: true,
        func:    function () {},
        nul:     null,
        number:  1337,
        object:  {},
        string:  "foo",
        undef1:  undefined,
    };

    const requirements = {
        array:   { is: ["array"] },
        boolean: { is: ["boolean"] },
        func:    { is: ["function"] },
        nul:     { is: ["null"] },
        number:  { is: ["number"] },
        object:  { is: ["object"] },
        string:  { is: ["string"] },
        undef1:  { is: ["undefined"] },
        undef2:  { is: ["undefined"] },
    };

    let val = vo.validateOptions(opts, requirements);

    test.deepEqual(val, opts);

    test.throws(
        () => vo.validateOptions(null, {foo: {is: ["object", "number"]}}),
        /^The option "foo" must be one of the following types: object, number/,
        "Invalid type should raise exception"
    );

    test.done();
};

exports.testValidateOptionsIsWithExportedValue = function (test) {
    const { string, number, boolean, object } = vo;

    const opts = {
        boolean: true,
        number:  1337,
        object:  {},
        string:  "foo",
    };

    const requirements = {
        string:  { is: string },
        number:  { is: number },
        boolean: { is: boolean },
        object:  { is: object },
    };

    let val;

    val = vo.validateOptions(opts, requirements);
    test.deepEqual(val, opts);

    // Test the types are optional by default
    val = vo.validateOptions({foo: 'bar'}, requirements);
    test.deepEqual(val, {});

    test.done();
};

exports.testValidateOptionsIsWithEither = function (test) {
    const { string, number, boolean, either } = vo;

    const text = {is: either(string, number)};

    const requirements = {
        text: text,
        boolOrText: {is: either(text, boolean)},
    };

    let val;

    val = vo.validateOptions({text: 12}, requirements);
    test.deepEqual(val, {text: 12});

    val = vo.validateOptions({text: "12"}, requirements);
    test.deepEqual(val, {text: "12"});

    val = vo.validateOptions({boolOrText: true}, requirements);
    test.deepEqual(val, {boolOrText: true});

    val = vo.validateOptions({boolOrText: "true"}, requirements);
    test.deepEqual(val, {boolOrText: "true"});

    val = vo.validateOptions({boolOrText: 1}, requirements);
    test.deepEqual(val, {boolOrText: 1});

    test.throws(
        () => vo.validateOptions({text: true}, requirements),
        /^The option "text" must be one of the following types/,
        "Invalid type should raise exception"
    );

    test.throws(
        () => vo.validateOptions({boolOrText: []}, requirements),
        /^The option "boolOrText" must be one of the following types/,
        "Invalid type should raise exception"
    );

    test.done();
};

exports.testValidateOptionsWithRequiredAndOptional = function (test) {
    const { string, number, required, optional } = vo;

    const opts = {
        number: 1337,
        string: "foo",
    };

    const requirements = {
        string: required(string),
        number: number,
    };

    let val;

    val = vo.validateOptions(opts, requirements);
    test.deepEqual(val, opts);

    val = vo.validateOptions({string: "foo"}, requirements);
    test.deepEqual(val, {string: "foo"});

    test.throws(
        () => vo.validateOptions({number: 10}, requirements),
        /^The option "string" must be one of the following types/,
        "Invalid type should raise exception"
    );

    // Makes string optional
    requirements.string = optional(requirements.string);

    val = vo.validateOptions({number: 10}, requirements),
    test.deepEqual(val, {number: 10});

    test.done();
};

exports.testValidateOptionsWithExportedValue = function (test) {
    const { string, number, boolean, object } = vo;

    const opts = {
        boolean: true,
        number:  1337,
        object:  {},
        string:  "foo",
    };

    const requirements = {
        string:  string,
        number:  number,
        boolean: boolean,
        object:  object,
    };

    let val;

    val = vo.validateOptions(opts, requirements);
    test.deepEqual(val, opts);

    // Test the types are optional by default
    val = vo.validateOptions({foo: 'bar'}, requirements);
    test.deepEqual(val, {});

    test.done();
};

exports.testValidateOptionsMapIsOk = function (test) {
    const [ map, is, ok ] = [false, false, false];

    let val = vo.validateOptions({foo: 1337}, {
        foo: {
            map: v => v.toString(),
            is: ["string"],
            ok: v => v.length > 0,
        }
    });

    test.deepEqual(val, {foo: "1337"});

    const requirements = {
        foo: {
            is: ["object"],
            ok: () => test.fail("is should have caused us to throw by now"),
        }
    };

    test.throws(
        () => vo.validateOptions(null, requirements),
        /^The option "foo" must be one of the following types: object/,
        "is should be used before ok is called"
    );

    test.done();
};

exports.testValidateOptionsErrorMsg = function (test) {
    test.throws(
        () => vo.validateOptions(null, {foo: {ok: v => v, msg: "foo!"}}),
        /^foo!/,
        "ok should raise exception with customized message"
    );

    test.done();
};

exports.testValidateMapWithMissingKey = function (test) {
    let val;

    val = vo.validateOptions({}, {foo: {map: v => v || "bar"}});
    test.deepEqual(val, {foo: "bar"});

    val = vo.validateOptions({}, {foo: {map: v => { throw "bar"; }}});
    test.deepEqual(val, {});

    test.done();
};

exports.testValidateMapWithMissingKeyAndThrown = function (test) {
    let val = vo.validateOptions({}, {
        bar: {map: function(v) { throw "bar"; }},
        baz: {map: v => "foo"},
    });

    test.deepEqual(val, { baz: "foo" });

    test.done();
};
