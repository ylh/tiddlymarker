'use strict';

const do_you_even = (obj, level, ...rest) => {
	if (obj === undefined)
		return false;
	if (rest.length == 0 && obj.hasOwnProperty(level))
		return true;
	return do_you_even(obj[level], ...rest)
};
