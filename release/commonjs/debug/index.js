"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const Adapter_1 = __importDefault(require("../src/decorators/Adapter"));
const After_1 = __importDefault(require("../src/decorators/After"));
const Before_1 = __importDefault(require("../src/decorators/Before"));
const Headers_1 = __importDefault(require("../src/decorators/Headers"));
const Get_1 = __importDefault(require("../src/decorators/HTTPMethods/Get"));
const index_1 = require("../src/index");
const adapter = {
    name: 'testAdapter',
    handler(config) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('async handler(config: any) {');
            console.log(config);
        });
    },
};
let Request = class Request {
    test() {
        return (0, index_1.makeBody)({
            placeholders: { id: 1 },
            query: { b: 2 },
            params: { c: 3 },
            onProgress: () => {
            },
            jsonp: '123',
        });
    }
};
__decorate([
    (0, Get_1.default)('123/:id')
    // @Headers('Auth', '123')
    ,
    (0, Headers_1.default)(() => {
        return {
            x: '2'
        };
    }),
    (0, Before_1.default)(() => {
        console.log('before');
        return true;
    }),
    (0, Adapter_1.default)(adapter)
    // @JSONP()
    ,
    (0, After_1.default)((a, b) => {
        console.log('after');
    })
], Request.prototype, "test", null);
Request = __decorate([
    (0, index_1.Prefix)('https://test.com'),
    (0, Before_1.default)(() => {
        console.log('class Before');
    }),
    (0, After_1.default)(() => {
        console.log('each after');
    })
], Request);
const req = new Request();
// console.log((req as any)[_prefixSymbol])
req.test();
// console.log(body({
//   params: {
//     a: 1,
//   }
// }));
