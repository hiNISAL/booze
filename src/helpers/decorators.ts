export const setMethodTag = (tag: string|symbol, value: any) => {
  return (target: any, methodName: string) => {
    target[methodName][tag] = value;
  }
};

export const setClassTag = (tag: string|symbol, value: any) => {
  return (target: any) => {
    target.prototype[tag] = value;
  }
};

export const setTag = (tag: string|symbol, value: any) => {
  return (target: any, name?: string) => {
    if (name) {
      target[name][tag] = value;

      return;
    }

    target.prototype[tag] = value;
  }
};

const getType = (value: any) => {
	return Object.prototype.toString.call(value).slice(8, -1);
}

export const isFunction = (target: any) => {
  return getType(target) === 'Function';
};

export const isObject = (target: any) => {
  return getType(target) === 'Object';
};

export const isArray = (target: any) => {
  return getType(target) === 'Array';
};

export const isPromise = (target: any) => {
  return getType(target) === 'Promise';
};

export const isString = (target: any) => {
  return getType(target) === 'String';
};

export const isUndefined = (target: any) => {
  return (typeof(target) === 'undefined');
};
