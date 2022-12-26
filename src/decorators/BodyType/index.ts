import { createSymbol, setTag } from "../../helpers/";

export const bodyTypeSymbol = createSymbol('bodyType');

type Type = 'Form'|'JSON';

const BodyType = (type: Type) => {
  return setTag(bodyTypeSymbol, type);
};

BodyType.Type = {
  Form: 'Form',
  JSON: 'JSON',
} as Record<string, Type>;

export const BodyTypeHeader: Record<Type, string> = {
  Form: 'application/x-www-form-urlencoded',
  JSON: 'application/json',
};

export default BodyType;
