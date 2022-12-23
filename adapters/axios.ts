import axios from 'axios';
import qs from 'qs';
import jsonp from 'axios-jsonp';
import { BoozeRequestConfig } from '../src/types';

const getMethod = (method: string) => {
  return (method || '').toLocaleUpperCase();
};

export default {
  name: 'axios',
  handler: async (options: BoozeRequestConfig) => {
    let queryString = '';
    const method = getMethod(options.method);

    if ((method === 'GET') || (method === 'JSONP')) {
      queryString = qs.stringify(options.query);
    }

    const axiosOptions: any = {
      url: `${options.url}${queryString ? `?${queryString}` : ''}`,
      method: options.method,
      data: options.params,
      headers: options.headers,
    };

    if (getMethod(options.method) === 'JSONP') {
      axiosOptions.adapter = jsonp;
      axiosOptions.callbackParamName = options.jsonp || 'callback';
    }

    const res = await axios(axiosOptions);

    return res;
  },
};
