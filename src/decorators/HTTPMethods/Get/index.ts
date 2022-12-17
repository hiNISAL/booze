import Request from "../Request";

export default (url: string, prefix?: string) => {
  return Request({
    url,
    prefix,
    method: 'GET',
  });
};
