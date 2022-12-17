export const prefixSymbol = Symbol('prefixPropKey');

export default (prefix: string) => {
  return (target: any) => {
    target.prototype[prefixSymbol] = prefix;
  };
};
