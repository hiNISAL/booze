"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setAdapter = exports.regAdapter = exports.eachAfter = exports.eachBeforeExecSourceFn = exports.makeBody = exports._bodyTypeSymbol = exports.BodyType = exports._prefixSymbol = exports.Prefix = exports._jsonpSymbol = exports.JSONP = exports._headerSymbol = exports.Headers = exports.Request = exports.Put = exports.Post = exports.Patch = exports.Options = exports.Head = exports.Get = exports.Delete = exports._beforeSymbol = exports.Before = exports._afterSymbol = exports.After = exports._adapterSymbol = exports.Adapter = void 0;
var Adapter_1 = require("./decorators/Adapter");
Object.defineProperty(exports, "Adapter", { enumerable: true, get: function () { return __importDefault(Adapter_1).default; } });
Object.defineProperty(exports, "_adapterSymbol", { enumerable: true, get: function () { return Adapter_1.adapterSymbol; } });
var After_1 = require("./decorators/After");
Object.defineProperty(exports, "After", { enumerable: true, get: function () { return __importDefault(After_1).default; } });
Object.defineProperty(exports, "_afterSymbol", { enumerable: true, get: function () { return After_1.afterSymbol; } });
var Before_1 = require("./decorators/Before");
Object.defineProperty(exports, "Before", { enumerable: true, get: function () { return __importDefault(Before_1).default; } });
Object.defineProperty(exports, "_beforeSymbol", { enumerable: true, get: function () { return Before_1.beforeSymbol; } });
var Delete_1 = require("./decorators/HTTPMethods/Delete");
Object.defineProperty(exports, "Delete", { enumerable: true, get: function () { return __importDefault(Delete_1).default; } });
var Get_1 = require("./decorators/HTTPMethods/Get");
Object.defineProperty(exports, "Get", { enumerable: true, get: function () { return __importDefault(Get_1).default; } });
var Head_1 = require("./decorators/HTTPMethods/Head");
Object.defineProperty(exports, "Head", { enumerable: true, get: function () { return __importDefault(Head_1).default; } });
var Options_1 = require("./decorators/HTTPMethods/Options");
Object.defineProperty(exports, "Options", { enumerable: true, get: function () { return __importDefault(Options_1).default; } });
var Patch_1 = require("./decorators/HTTPMethods/Patch");
Object.defineProperty(exports, "Patch", { enumerable: true, get: function () { return __importDefault(Patch_1).default; } });
var Post_1 = require("./decorators/HTTPMethods/Post");
Object.defineProperty(exports, "Post", { enumerable: true, get: function () { return __importDefault(Post_1).default; } });
var Put_1 = require("./decorators/HTTPMethods/Put");
Object.defineProperty(exports, "Put", { enumerable: true, get: function () { return __importDefault(Put_1).default; } });
var Request_1 = require("./decorators/HTTPMethods/Request");
Object.defineProperty(exports, "Request", { enumerable: true, get: function () { return __importDefault(Request_1).default; } });
var Headers_1 = require("./decorators/Headers");
Object.defineProperty(exports, "Headers", { enumerable: true, get: function () { return __importDefault(Headers_1).default; } });
Object.defineProperty(exports, "_headerSymbol", { enumerable: true, get: function () { return Headers_1.headerSymbol; } });
var JSONP_1 = require("./decorators/JSONP");
Object.defineProperty(exports, "JSONP", { enumerable: true, get: function () { return __importDefault(JSONP_1).default; } });
Object.defineProperty(exports, "_jsonpSymbol", { enumerable: true, get: function () { return JSONP_1.jsonpSymbol; } });
var Prefix_1 = require("./decorators/Prefix");
Object.defineProperty(exports, "Prefix", { enumerable: true, get: function () { return __importDefault(Prefix_1).default; } });
Object.defineProperty(exports, "_prefixSymbol", { enumerable: true, get: function () { return Prefix_1.prefixSymbol; } });
var BodyType_1 = require("./decorators/BodyType");
Object.defineProperty(exports, "BodyType", { enumerable: true, get: function () { return __importDefault(BodyType_1).default; } });
Object.defineProperty(exports, "_bodyTypeSymbol", { enumerable: true, get: function () { return BodyType_1.bodyTypeSymbol; } });
var makeBody_1 = require("./methods/makeBody");
Object.defineProperty(exports, "makeBody", { enumerable: true, get: function () { return makeBody_1.makeBody; } });
var eachBeforeExecSourceFn_1 = require("./methods/eachBeforeExecSourceFn");
Object.defineProperty(exports, "eachBeforeExecSourceFn", { enumerable: true, get: function () { return eachBeforeExecSourceFn_1.eachBeforeExecSourceFn; } });
var eachAfter_1 = require("./methods/eachAfter");
Object.defineProperty(exports, "eachAfter", { enumerable: true, get: function () { return eachAfter_1.eachAfter; } });
const adapter_1 = __importDefault(require("./adapter"));
exports.regAdapter = adapter_1.default.regAdapter.bind(adapter_1.default);
exports.setAdapter = adapter_1.default.setAdapter.bind(adapter_1.default);