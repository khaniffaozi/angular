var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Injectable } from 'angular2/src/core/di';
import { StringWrapper, RegExpWrapper, CONST_EXPR, isPresent } from 'angular2/src/facade/lang';
import { HtmlAttrAst, HtmlElementAst } from './html_ast';
import { HtmlParser, HtmlParseTreeResult } from './html_parser';
import { dashCaseToCamelCase } from './util';
var LONG_SYNTAX_REGEXP = /^(?:on-(.*)|bindon-(.*)|bind-(.*)|var-(.*))$/ig;
var SHORT_SYNTAX_REGEXP = /^(?:\((.*)\)|\[\((.*)\)\]|\[(.*)\]|#(.*))$/ig;
var VARIABLE_TPL_BINDING_REGEXP = /(\bvar\s+|#)(\S+)/ig;
var TEMPLATE_SELECTOR_REGEXP = /^(\S+)/g;
var SPECIAL_PREFIXES_REGEXP = /^(class|style|attr)\./ig;
var INTERPOLATION_REGEXP = /\{\{.*?\}\}/g;
const SPECIAL_CASES = CONST_EXPR([
    'ng-non-bindable',
    'ng-default-control',
    'ng-no-form',
]);
/**
 * Convert templates to the case sensitive syntax
 *
 * @internal
 */
export class LegacyHtmlAstTransformer {
    constructor(dashCaseSelectors) {
        this.dashCaseSelectors = dashCaseSelectors;
        this.rewrittenAst = [];
        this.visitingTemplateEl = false;
    }
    visitComment(ast, context) { return ast; }
    visitElement(ast, context) {
        this.visitingTemplateEl = ast.name.toLowerCase() == 'template';
        let attrs = ast.attrs.map(attr => attr.visit(this, null));
        let children = ast.children.map(child => child.visit(this, null));
        return new HtmlElementAst(ast.name, attrs, children, ast.sourceSpan, ast.startSourceSpan, ast.endSourceSpan);
    }
    visitAttr(originalAst, context) {
        let ast = originalAst;
        if (this.visitingTemplateEl) {
            if (isPresent(RegExpWrapper.firstMatch(LONG_SYNTAX_REGEXP, ast.name))) {
                // preserve the "-" in the prefix for the long syntax
                ast = this._rewriteLongSyntax(ast);
            }
            else {
                // rewrite any other attribute
                let name = dashCaseToCamelCase(ast.name);
                ast = name == ast.name ? ast : new HtmlAttrAst(name, ast.value, ast.sourceSpan);
            }
        }
        else {
            ast = this._rewriteTemplateAttribute(ast);
            ast = this._rewriteLongSyntax(ast);
            ast = this._rewriteShortSyntax(ast);
            ast = this._rewriteStar(ast);
            ast = this._rewriteInterpolation(ast);
            ast = this._rewriteSpecialCases(ast);
        }
        if (ast !== originalAst) {
            this.rewrittenAst.push(ast);
        }
        return ast;
    }
    visitText(ast, context) { return ast; }
    _rewriteLongSyntax(ast) {
        let m = RegExpWrapper.firstMatch(LONG_SYNTAX_REGEXP, ast.name);
        let attrName = ast.name;
        let attrValue = ast.value;
        if (isPresent(m)) {
            if (isPresent(m[1])) {
                attrName = `on-${dashCaseToCamelCase(m[1])}`;
            }
            else if (isPresent(m[2])) {
                attrName = `bindon-${dashCaseToCamelCase(m[2])}`;
            }
            else if (isPresent(m[3])) {
                attrName = `bind-${dashCaseToCamelCase(m[3])}`;
            }
            else if (isPresent(m[4])) {
                attrName = `var-${dashCaseToCamelCase(m[4])}`;
                attrValue = dashCaseToCamelCase(attrValue);
            }
        }
        return attrName == ast.name && attrValue == ast.value ?
            ast :
            new HtmlAttrAst(attrName, attrValue, ast.sourceSpan);
    }
    _rewriteTemplateAttribute(ast) {
        let name = ast.name;
        let value = ast.value;
        if (name.toLowerCase() == 'template') {
            name = 'template';
            // rewrite the directive selector
            value = StringWrapper.replaceAllMapped(value, TEMPLATE_SELECTOR_REGEXP, (m) => { return dashCaseToCamelCase(m[1]); });
            // rewrite the var declarations
            value = StringWrapper.replaceAllMapped(value, VARIABLE_TPL_BINDING_REGEXP, m => {
                return `${m[1].toLowerCase()}${dashCaseToCamelCase(m[2])}`;
            });
        }
        if (name == ast.name && value == ast.value) {
            return ast;
        }
        return new HtmlAttrAst(name, value, ast.sourceSpan);
    }
    _rewriteShortSyntax(ast) {
        let m = RegExpWrapper.firstMatch(SHORT_SYNTAX_REGEXP, ast.name);
        let attrName = ast.name;
        let attrValue = ast.value;
        if (isPresent(m)) {
            if (isPresent(m[1])) {
                attrName = `(${dashCaseToCamelCase(m[1])})`;
            }
            else if (isPresent(m[2])) {
                attrName = `[(${dashCaseToCamelCase(m[2])})]`;
            }
            else if (isPresent(m[3])) {
                let prop = StringWrapper.replaceAllMapped(m[3], SPECIAL_PREFIXES_REGEXP, (m) => { return m[1].toLowerCase() + '.'; });
                if (prop.startsWith('class.') || prop.startsWith('attr.') || prop.startsWith('style.')) {
                    attrName = `[${prop}]`;
                }
                else {
                    attrName = `[${dashCaseToCamelCase(prop)}]`;
                }
            }
            else if (isPresent(m[4])) {
                attrName = `#${dashCaseToCamelCase(m[4])}`;
                attrValue = dashCaseToCamelCase(attrValue);
            }
        }
        return attrName == ast.name && attrValue == ast.value ?
            ast :
            new HtmlAttrAst(attrName, attrValue, ast.sourceSpan);
    }
    _rewriteStar(ast) {
        let attrName = ast.name;
        let attrValue = ast.value;
        if (attrName[0] == '*') {
            attrName = dashCaseToCamelCase(attrName);
            // rewrite the var declarations
            attrValue = StringWrapper.replaceAllMapped(attrValue, VARIABLE_TPL_BINDING_REGEXP, m => {
                return `${m[1].toLowerCase()}${dashCaseToCamelCase(m[2])}`;
            });
        }
        return attrName == ast.name && attrValue == ast.value ?
            ast :
            new HtmlAttrAst(attrName, attrValue, ast.sourceSpan);
    }
    _rewriteInterpolation(ast) {
        let hasInterpolation = RegExpWrapper.test(INTERPOLATION_REGEXP, ast.value);
        if (!hasInterpolation) {
            return ast;
        }
        let name = ast.name;
        if (!(name.startsWith('attr.') || name.startsWith('class.') || name.startsWith('style.'))) {
            name = dashCaseToCamelCase(ast.name);
        }
        return name == ast.name ? ast : new HtmlAttrAst(name, ast.value, ast.sourceSpan);
    }
    _rewriteSpecialCases(ast) {
        let attrName = ast.name;
        if (SPECIAL_CASES.indexOf(attrName) > -1) {
            return new HtmlAttrAst(dashCaseToCamelCase(attrName), ast.value, ast.sourceSpan);
        }
        if (isPresent(this.dashCaseSelectors) && this.dashCaseSelectors.indexOf(attrName) > -1) {
            return new HtmlAttrAst(dashCaseToCamelCase(attrName), ast.value, ast.sourceSpan);
        }
        return ast;
    }
}
export let LegacyHtmlParser = class extends HtmlParser {
    parse(sourceContent, sourceUrl) {
        let transformer = new LegacyHtmlAstTransformer();
        let htmlParseTreeResult = super.parse(sourceContent, sourceUrl);
        let rootNodes = htmlParseTreeResult.rootNodes.map(node => node.visit(transformer, null));
        return transformer.rewrittenAst.length > 0 ?
            new HtmlParseTreeResult(rootNodes, htmlParseTreeResult.errors) :
            htmlParseTreeResult;
    }
};
LegacyHtmlParser = __decorate([
    Injectable(), 
    __metadata('design:paramtypes', [])
], LegacyHtmlParser);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGVnYWN5X3RlbXBsYXRlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZGlmZmluZ19wbHVnaW5fd3JhcHBlci1vdXRwdXRfcGF0aC1YOUpCTUdDZy50bXAvYW5ndWxhcjIvc3JjL2NvbXBpbGVyL2xlZ2FjeV90ZW1wbGF0ZS50cyJdLCJuYW1lcyI6WyJMZWdhY3lIdG1sQXN0VHJhbnNmb3JtZXIiLCJMZWdhY3lIdG1sQXN0VHJhbnNmb3JtZXIuY29uc3RydWN0b3IiLCJMZWdhY3lIdG1sQXN0VHJhbnNmb3JtZXIudmlzaXRDb21tZW50IiwiTGVnYWN5SHRtbEFzdFRyYW5zZm9ybWVyLnZpc2l0RWxlbWVudCIsIkxlZ2FjeUh0bWxBc3RUcmFuc2Zvcm1lci52aXNpdEF0dHIiLCJMZWdhY3lIdG1sQXN0VHJhbnNmb3JtZXIudmlzaXRUZXh0IiwiTGVnYWN5SHRtbEFzdFRyYW5zZm9ybWVyLl9yZXdyaXRlTG9uZ1N5bnRheCIsIkxlZ2FjeUh0bWxBc3RUcmFuc2Zvcm1lci5fcmV3cml0ZVRlbXBsYXRlQXR0cmlidXRlIiwiTGVnYWN5SHRtbEFzdFRyYW5zZm9ybWVyLl9yZXdyaXRlU2hvcnRTeW50YXgiLCJMZWdhY3lIdG1sQXN0VHJhbnNmb3JtZXIuX3Jld3JpdGVTdGFyIiwiTGVnYWN5SHRtbEFzdFRyYW5zZm9ybWVyLl9yZXdyaXRlSW50ZXJwb2xhdGlvbiIsIkxlZ2FjeUh0bWxBc3RUcmFuc2Zvcm1lci5fcmV3cml0ZVNwZWNpYWxDYXNlcyIsIkxlZ2FjeUh0bWxQYXJzZXIiLCJMZWdhY3lIdG1sUGFyc2VyLnBhcnNlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7T0FBTyxFQUFDLFVBQVUsRUFBb0IsTUFBTSxzQkFBc0I7T0FFM0QsRUFDTCxhQUFhLEVBQ2IsYUFBYSxFQUNiLFVBQVUsRUFFVixTQUFTLEVBQ1YsTUFBTSwwQkFBMEI7T0FFMUIsRUFFTCxXQUFXLEVBQ1gsY0FBYyxFQUlmLE1BQU0sWUFBWTtPQUNaLEVBQUMsVUFBVSxFQUFFLG1CQUFt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Q0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0E7WUFDakJBLEVBQUVBLENBQUNBLENBQUNBLFNBQVNBLENBQUNBLENBQUNBLENBQUNBLENBQUNBLENBQUNBLENBQUNBLENBQUNBLENBQUNBLENBQUNBO2dCQUNwQkEsUUFBUUEsR0FBR0EsTUFBTUEsbUJBQW1CQSxDQUFDQSxDQUFDQSxDQUFDQSxDQUFDQSxDQUFDQSxDQUFDQSxFQUFFQSxDQUFDQTtZQUMvQ0EsQ0FBQ0E7WUFBQ0EsSUFBSUEsQ0FBQ0EsRUFBRUEsQ0FBQ0EsQ0FBQ0EsU0FBU0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0E7Z0JBQzNCQSxRQUFRQSxHQUFHQSxVQUFVQSxtQkFBbUJBLENBQUNBLENBQUNBLENBQUNBLENBQUNBLENBQUNBLENBQUNBLEVBQUVBLENBQUNBO1lBQ25EQSxDQUFDQTtZQUFDQSxJQUFJQSxDQUFDQSxFQUFFQSxDQUFDQSxDQUFDQSxTQUFTQSxDQUFDQSxDQUFDQSxDQUFDQSxDQUFDQSxDQUFDQSxDQUFDQSxDQUFDQSxDQUFDQSxDQUFDQTtnQkFDM0JBLFFBQVFBLEdBQUdBLFFBQVFBLG1CQUFtQkEsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsRUFBRUEsQ0FBQ0E7WUFDakRBLENBQUNBO1lBQUNBLElBQUlBLENBQUNBLEVBQUVBLENBQUNBLENBQUNBLFNBQVNBLENBQUNBLENBQUNBLENBQUNBLENBQUNBLENBQUNBLENBQUNBLENBQUNBLENBQUNBLENBQUNBO2dCQUMzQkEsUUFBUUEsR0FBR0EsT0FBT0EsbUJBQW1CQSxDQUFDQSxDQUFDQSxDQUFDQSxDQUFDQSxDQUFDQSxDQUFDQSxFQUFFQSxDQUFDQTtnQkFDOUNBLFNBQVNBLEdBQUdBLG1CQUFtQkEsQ0FBQ0EsU0FBU0EsQ0FBQ0EsQ0FBQ0E7WUFDN0NBLENBQUNBO1FBQ0hBLENBQUNBO1FBRURBLE1BQU1BLENBQUNBLFFBQVFBLElBQUlBLEdBQUdBLENBQUNBLElBQUlBLElB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bnRlbnQiOlsiaW1wb3J0IHtJbmplY3RhYmxlLCBQcm92aWRlciwgcHJvdmlkZX0gZnJvbSAnYW5ndWxhcjIvc3JjL2NvcmUvZGknO1xuXG5pbXBvcnQge1xuICBTdHJpbmdXcmFwcGVyLFxuICBSZWdFeHBXcmFwcGVyLFxuICBDT05TVF9FWFBSLFxuICBpc0JsYW5rLFxuICBpc1ByZXNlbnRcbn0gZnJvbSAnYW5ndWxhcjIvc3JjL2ZhY2FkZS9sYW5nJztcblxuaW1wb3J0IHtcbiAgSHRtbEFzdFZpc2l0b3IsXG4gIEh0bWxBdHRyQXN0LFxuICBIdG1sRWxlbWVudEFzdCxcbiAgSHRtbFRleHRBc3QsXG4gIEh0bWxDb21tZW50QXN0LFxuICBIdG1sQXN0XG59IGZyb20gJy4vaHRtbF9hc3QnO1xuaW1wb3J0IHtIdG1sUGFyc2VyLCBIdG1sUGFyc2VUcmVlUmVzdWx0fSBmcm9tICcuL2h0bWxfcGFyc2VyJztcblxuaW1wb3J0IHtkYXNoQ2FzZVRvQ2FtZWxDYXNlLCBjYW1lbENhc2VUb0Rhc2hDYXNlfSBmcm9tICcuL3V0aWwnO1xuXG52YXIgTE9OR19TWU5UQVhfUkVHRVhQID0gL14oPzpvbi0oLiopfGJpbmRvbi0oLiopfGJpbmQtKC4qKXx2YXItKC4qKSkkL2lnO1xudmFyIFNIT1JUX1NZTlRBWF9SRUdFWFAgPSAvXig/OlxcKCguKilcXCl8XFxbXFwoKC4qKVxcKVxcXXxcXFsoLiopXFxdfCMoLiopKSQvaWc7XG52YXIgVkFSSUFCTEVfVFBMX0JJTkRJTkdfUkVHRVhQID0gLyhcXGJ2YXJcXHMrfCMpKFxcUyspL2lnO1xudmFyIFRFTVBMQVRFX1NFTEVDVE9SX1JFR0VYUCA9IC9eKFxcUyspL2c7XG52YXIgU1BFQ0lBTF9QUkVGSVhFU19SRUdFWFAgPSAvXihjbGFzc3xzdHlsZXxhdHRyKVxcLi9pZztcbnZhciBJTlRFUlBPTEFUSU9OX1JFR0VYUCA9IC9cXHtcXHsuKj9cXH1cXH0vZztcblxuY29uc3QgU1BFQ0lBTF9DQVNFUyA9IENPTlNUX0VYUFIoW1xuICAnbmctbm9uLWJpbmRhYmxlJyxcbiAgJ25nLWRlZmF1bHQtY29udHJvbCcsXG4gICduZy1uby1mb3JtJyxcbl0pO1xuXG4vKipcbiAqIENvbnZlcnQgdGVtcGxhdGVzIHRvIHRoZSBjYXNlIHNlbnNpdGl2ZSBzeW50YXhcbiAqXG4gKiBAaW50ZXJuYWxcbiAqL1xuZXhwb3J0IGNsYXNzIExlZ2FjeUh0bWxBc3RUcmFuc2Zvcm1lciBpbXBsZW1lbnRzIEh0bWxBc3RWaXNpdG9yIHtcbiAgcmV3cml0dGVuQXN0OiBIdG1sQXN0W10gPSBbXTtcbiAgdmlzaXRpbmdUZW1wbGF0ZUVsOiBib29sZWFuID0gZmFsc2U7XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSBkYXNoQ2FzZVNlbGVjdG9ycz86IHN0cmluZ1tdKSB7fVxuXG4gIHZpc2l0Q29tbWVudChhc3Q6IEh0bWxDb21tZW50QXN0LCBjb250ZXh0OiBhbnkpOiBhbnkgeyByZXR1cm4gYXN0OyB9XG5cbiAgdmlzaXRFbGVtZW50KGFzdDogSHRtbEVsZW1lbnRBc3QsIGNvbnRleHQ6IGFueSk6IEh0bWxFbGVtZW50QXN0IHtcbiAgICB0aGlzLnZpc2l0aW5nVGVtcGxhdGVFbCA9IGFzdC5uYW1lLnRvTG93ZXJDYXNlKCkgPT0gJ3RlbXBsYXRlJztcbiAgICBsZXQgYXR0cnMgPSBhc3QuYXR0cnMubWFwKGF0dHIgPT4gYXR0ci52aXNpdCh0aGlzLCBudWxsKSk7XG4gICAgbGV0IGNoaWxkcmVuID0gYXN0LmNoaWxkcmVuLm1hcChjaGlsZCA9PiBjaGlsZC52aXNpdCh0aGlzLCBudWxsKSk7XG4gICAgcmV0dXJuIG5ldyBIdG1sRWxlbWVudEFzdChhc3QubmFtZSwgYXR0cnMsIGNoaWxkcmVuLCBhc3Quc291cmNlU3BhbiwgYXN0LnN0YXJ0U291cmNlU3BhbixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFzdC5lbmRTb3VyY2VTcGFuKTtcbiAgfVxuXG4gIHZpc2l0QXR0cihvcmlnaW5hbEFzdDogSHRtbEF0dHJBc3QsIGNvbnRleHQ6IGFueSk6IEh0bWxBdHRyQXN0IHtcbiAgICBsZXQgYXN0ID0gb3JpZ2luYWxBc3Q7XG5cbiAgICBpZiAodGhpcy52aXNpdGluZ1RlbXBsYXRlRWwpIHtcbiAgICAgIGlmIChpc1ByZXNlbnQoUmVnRXhwV3JhcHBlci5maXJzdE1hdGNoKExPTkdfU1lOVEFYX1JFR0VYUCwgYXN0Lm5hbWUpKSkge1xuICAgICAgICAvLyBwcmVzZXJ2ZSB0aGUgXCItXCIgaW4gdGhlIHByZWZpeCBmb3IgdGhlIGxvbmcgc3ludGF4XG4gICAgICAgIGFzdCA9IHRoaXMuX3Jld3JpdGVMb25nU3ludGF4KGFzdCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyByZXdyaXRlIGFueSBvdGhlciBhdHRyaWJ1dGVcbiAgICAgICAgbGV0IG5hbWUgPSBkYXNoQ2FzZVRvQ2FtZWxDYXNlKGFzdC5uYW1lKTtcbiAgICAgICAgYXN0ID0gbmFtZSA9PSBhc3QubmFtZSA/IGFzdCA6IG5ldyBIdG1sQXR0ckFzdChuYW1lLCBhc3QudmFsdWUsIGFzdC5zb3VyY2VTcGFuKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgYXN0ID0gdGhpcy5fcmV3cml0ZVRlbXBsYXRlQXR0cmlidXRlKGFzdCk7XG4gICAgICBhc3QgPSB0aGlzLl9yZXdyaXRlTG9uZ1N5bnRheChhc3QpO1xuICAgICAgYXN0ID0gdGhpcy5fcmV3cml0ZVNob3J0U3ludGF4KGFzdCk7XG4gICAgICBhc3QgPSB0aGlzLl9yZXdyaXRlU3Rhcihhc3QpO1xuICAgICAgYXN0ID0gdGhpcy5fcmV3cml0ZUludGVycG9sYXRpb24oYXN0KTtcbiAgICAgIGFzdCA9IHRoaXMuX3Jld3JpdGVTcGVjaWFsQ2FzZXMoYXN0KTtcbiAgICB9XG5cbiAgICBpZiAoYXN0ICE9PSBvcmlnaW5hbEFzdCkge1xuICAgICAgdGhpcy5yZXdyaXR0ZW5Bc3QucHVzaChhc3QpO1xuICAgIH1cblxuICAgIHJldHVybiBhc3Q7XG4gIH1cblxuICB2aXNpdFRleHQoYXN0OiBIdG1sVGV4dEFzdCwgY29udGV4dDogYW55KTogSHRtbFRleHRBc3QgeyByZXR1cm4gYXN0OyB9XG5cbiAgcHJpdmF0ZSBfcmV3cml0ZUxvbmdTeW50YXgoYXN0OiBIdG1sQXR0ckFzdCk6IEh0bWxBdHRyQXN0IHtcbiAgICBsZXQgbSA9IFJlZ0V4cFdyYXBwZXIuZmlyc3RNYXRjaChMT05HX1NZTlRBWF9SRUdFWFAsIGFzdC5uYW1lKTtcbiAgICBsZXQgYXR0ck5hbWUgPSBhc3QubmFtZTtcbiAgICBsZXQgYXR0clZhbHVlID0gYXN0LnZhbHVlO1xuXG4gICAgaWYgKGlzUHJlc2VudChtKSkge1xuICAgICAgaWYgKGlzUHJlc2VudChtWzFdKSkge1xuICAgICAgICBhdHRyTmFtZSA9IGBvbi0ke2Rhc2hDYXNlVG9DYW1lbENhc2UobVsxXSl9YDtcbiAgICAgIH0gZWxzZSBpZiAoaXNQcmVzZW50KG1bMl0pKSB7XG4gICAgICAgIGF0dHJOYW1lID0gYGJpbmRvbi0ke2Rhc2hDYXNlVG9DYW1lbENhc2UobVsyXSl9YDtcbiAgICAgIH0gZWxzZSBpZiAoaXNQcmVzZW50KG1bM10pKSB7XG4gICAgICAgIGF0dHJOYW1lID0gYGJpbmQtJHtkYXNoQ2FzZVRvQ2FtZWxDYXNlKG1bM10pfWA7XG4gICAgICB9IGVsc2UgaWYgKGlzUHJlc2VudChtWzRdKSkge1xuICAgICAgICBhdHRyTmFtZSA9IGB2YXItJHtkYXNoQ2FzZVRvQ2FtZWxDYXNlKG1bNF0pfWA7XG4gICAgICAgIGF0dHJWYWx1ZSA9IGRhc2hDYXNlVG9DYW1lbENhc2UoYXR0clZhbHVlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gYXR0ck5hbWUgPT0gYXN0Lm5hbWUgJiYgYXR0clZhbHVlID09IGFzdC52YWx1ZSA/XG4gICAgICAgICAgICAgICBhc3QgOlxuICAgICAgICAgICAgICAgbmV3IEh0bWxBdHRyQXN0KGF0dHJOYW1lLCBhdHRyVmFsdWUsIGFzdC5zb3VyY2VTcGFuKTtcbiAgfVxuXG4gIHByaXZhdGUgX3Jld3JpdGVUZW1wbGF0ZUF0dHJpYnV0ZShhc3Q6IEh0bWxBdHRyQXN0KTogSHRtbEF0dHJBc3Qge1xuICAgIGxldCBuYW1lID0gYXN0Lm5hbWU7XG4gICAgbGV0IHZhbHVlID0gYXN0LnZhbHVlO1xuXG4gICAgaWYgKG5hbWUudG9Mb3dlckNhc2UoKSA9PSAndGVtcGxhdGUnKSB7XG4gICAgICBuYW1lID0gJ3RlbXBsYXRlJztcblxuICAgICAgLy8gcmV3cml0ZSB0aGUgZGlyZWN0aXZlIHNlbGVjdG9yXG4gICAgICB2YWx1ZSA9IFN0cmluZ1dyYXBwZXIucmVwbGFjZUFsbE1hcHBlZCh2YWx1ZSwgVEVNUExBVEVfU0VMRUNUT1JfUkVHRVhQLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKG0pID0+IHsgcmV0dXJuIGRhc2hDYXNlVG9DYW1lbENhc2UobVsxXSk7IH0pO1xuXG4gICAgICAvLyByZXdyaXRlIHRoZSB2YXIgZGVjbGFyYXRpb25zXG4gICAgICB2YWx1ZSA9IFN0cmluZ1dyYXBwZXIucmVwbGFjZUFsbE1hcHBlZCh2YWx1ZSwgVkFSSUFCTEVfVFBMX0JJTkRJTkdfUkVHRVhQLCBtID0+IHtcbiAgICAgICAgcmV0dXJuIGAke21bMV0udG9Mb3dlckNhc2UoKX0ke2Rhc2hDYXNlVG9DYW1lbENhc2UobVsyXSl9YDtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGlmIChuYW1lID09IGFzdC5uYW1lICYmIHZhbHVlID09IGFzdC52YWx1ZSkge1xuICAgICAgcmV0dXJuIGFzdDtcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IEh0bWxBdHRyQXN0KG5hbWUsIHZhbHVlLCBhc3Quc291cmNlU3Bhbik7XG4gIH1cblxuICBwcml2YXRlIF9yZXdyaXRlU2hvcnRTeW50YXgoYXN0OiBIdG1sQXR0ckFzdCk6IEh0bWxBdHRyQXN0IHtcbiAgICBsZXQgbSA9IFJlZ0V4cFdyYXBwZXIuZmlyc3RNYXRjaChTSE9SVF9TWU5UQVhfUkVHRVhQLCBhc3QubmFtZSk7XG4gICAgbGV0IGF0dHJOYW1lID0gYXN0Lm5hbWU7XG4gICAgbGV0IGF0dHJWYWx1ZSA9IGFzdC52YWx1ZTtcblxuICAgIGlmIChpc1ByZXNlbnQobSkpIHtcbiAgICAgIGlmIChpc1ByZXNlbnQobVsxXSkpIHtcbiAgICAgICAgYXR0ck5hbWUgPSBgKCR7ZGFzaENhc2VUb0NhbWVsQ2FzZShtWzFdKX0pYDtcbiAgICAgIH0gZWxzZSBpZiAoaXNQcmVzZW50KG1bMl0pKSB7XG4gICAgICAgIGF0dHJOYW1lID0gYFsoJHtkYXNoQ2FzZVRvQ2FtZWxDYXNlKG1bMl0pfSldYDtcbiAgICAgIH0gZWxzZSBpZiAoaXNQcmVzZW50KG1bM10pKSB7XG4gICAgICAgIGxldCBwcm9wID0gU3RyaW5nV3JhcHBlci5yZXBsYWNlQWxsTWFwcGVkKG1bM10sIFNQRUNJQUxfUFJFRklYRVNfUkVHRVhQLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAobSkgPT4geyByZXR1cm4gbVsxXS50b0xvd2VyQ2FzZSgpICsgJy4nOyB9KTtcblxuICAgICAgICBpZiAocHJvcC5zdGFydHNXaXRoKCdjbGFzcy4nKSB8fCBwcm9wLnN0YXJ0c1dpdGgoJ2F0dHIuJykgfHwgcHJvcC5zdGFydHNXaXRoKCdzdHlsZS4nKSkge1xuICAgICAgICAgIGF0dHJOYW1lID0gYFske3Byb3B9XWA7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgYXR0ck5hbWUgPSBgWyR7ZGFzaENhc2VUb0NhbWVsQ2FzZShwcm9wKX1dYDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChpc1ByZXNlbnQobVs0XSkpIHtcbiAgICAgICAgYXR0ck5hbWUgPSBgIyR7ZGFzaENhc2VUb0NhbWVsQ2FzZShtWzRdKX1gO1xuICAgICAgICBhdHRyVmFsdWUgPSBkYXNoQ2FzZVRvQ2FtZWxDYXNlKGF0dHJWYWx1ZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGF0dHJOYW1lID09IGFzdC5uYW1lICYmIGF0dHJWYWx1ZSA9PSBhc3QudmFsdWUgP1xuICAgICAgICAgICAgICAgYXN0IDpcbiAgICAgICAgICAgICAgIG5ldyBIdG1sQXR0ckFzdChhdHRyTmFtZSwgYXR0clZhbHVlLCBhc3Quc291cmNlU3Bhbik7XG4gIH1cblxuICBwcml2YXRlIF9yZXdyaXRlU3Rhcihhc3Q6IEh0bWxBdHRyQXN0KTogSHRtbEF0dHJBc3Qge1xuICAgIGxldCBhdHRyTmFtZSA9IGFzdC5uYW1lO1xuICAgIGxldCBhdHRyVmFsdWUgPSBhc3QudmFsdWU7XG5cbiAgICBpZiAoYXR0ck5hbWVbMF0gPT0gJyonKSB7XG4gICAgICBhdHRyTmFtZSA9IGRhc2hDYXNlVG9DYW1lbENhc2UoYXR0ck5hbWUpO1xuICAgICAgLy8gcmV3cml0ZSB0aGUgdmFyIGRlY2xhcmF0aW9uc1xuICAgICAgYXR0clZhbHVlID0gU3RyaW5nV3JhcHBlci5yZXBsYWNlQWxsTWFwcGVkKGF0dHJWYWx1ZSwgVkFSSUFCTEVfVFBMX0JJTkRJTkdfUkVHRVhQLCBtID0+IHtcbiAgICAgICAgcmV0dXJuIGAke21bMV0udG9Mb3dlckNhc2UoKX0ke2Rhc2hDYXNlVG9DYW1lbENhc2UobVsyXSl9YDtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiBhdHRyTmFtZSA9PSBhc3QubmFtZSAmJiBhdHRyVmFsdWUgPT0gYXN0LnZhbHVlID9cbiAgICAgICAgICAgICAgIGFzdCA6XG4gICAgICAgICAgICAgICBuZXcgSHRtbEF0dHJBc3QoYXR0ck5hbWUsIGF0dHJWYWx1ZSwgYXN0LnNvdXJjZVNwYW4pO1xuICB9XG5cbiAgcHJpdmF0ZSBfcmV3cml0ZUludGVycG9sYXRpb24oYXN0OiBIdG1sQXR0ckFzdCk6IEh0bWxBdHRyQXN0IHtcbiAgICBsZXQgaGFzSW50ZXJwb2xhdGlvbiA9IFJlZ0V4cFdyYXBwZXIudGVzdChJTlRFUlBPTEFUSU9OX1JFR0VYUCwgYXN0LnZhbHVlKTtcblxuICAgIGlmICghaGFzSW50ZXJwb2xhdGlvbikge1xuICAgICAgcmV0dXJuIGFzdDtcbiAgICB9XG5cbiAgICBsZXQgbmFtZSA9IGFzdC5uYW1lO1xuXG4gICAgaWYgKCEobmFtZS5zdGFydHNXaXRoKCdhdHRyLicpIHx8IG5hbWUuc3RhcnRzV2l0aCgnY2xhc3MuJykgfHwgbmFtZS5zdGFydHNXaXRoKCdzdHlsZS4nKSkpIHtcbiAgICAgIG5hbWUgPSBkYXNoQ2FzZVRvQ2FtZWxDYXNlKGFzdC5uYW1lKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbmFtZSA9PSBhc3QubmFtZSA/IGFzdCA6IG5ldyBIdG1sQXR0ckFzdChuYW1lLCBhc3QudmFsdWUsIGFzdC5zb3VyY2VTcGFuKTtcbiAgfVxuXG4gIHByaXZhdGUgX3Jld3JpdGVTcGVjaWFsQ2FzZXMoYXN0OiBIdG1sQXR0ckFzdCk6IEh0bWxBdHRyQXN0IHtcbiAgICBsZXQgYXR0ck5hbWUgPSBhc3QubmFtZTtcblxuICAgIGlmIChTUEVDSUFMX0NBU0VTLmluZGV4T2YoYXR0ck5hbWUpID4gLTEpIHtcbiAgICAgIHJldHVybiBuZXcgSHRtbEF0dHJBc3QoZGFzaENhc2VUb0NhbWVsQ2FzZShhdHRyTmFtZSksIGFzdC52YWx1ZSwgYXN0LnNvdXJjZVNwYW4pO1xuICAgIH1cblxuICAgIGlmIChpc1ByZXNlbnQodGhpcy5kYXNoQ2FzZVNlbGVjdG9ycykgJiYgdGhpcy5kYXNoQ2FzZVNlbGVjdG9ycy5pbmRleE9mKGF0dHJOYW1lKSA+IC0xKSB7XG4gICAgICByZXR1cm4gbmV3IEh0bWxBdHRyQXN0KGRhc2hDYXNlVG9DYW1lbENhc2UoYXR0ck5hbWUpLCBhc3QudmFsdWUsIGFzdC5zb3VyY2VTcGFuKTtcbiAgICB9XG5cbiAgICByZXR1cm4gYXN0O1xuICB9XG59XG5cbkBJbmplY3RhYmxlKClcbmV4cG9ydCBjbGFzcyBMZWdhY3lIdG1sUGFyc2VyIGV4dGVuZHMgSHRtbFBhcnNlciB7XG4gIHBhcnNlKHNvdXJjZUNvbnRlbnQ6IHN0cmluZywgc291cmNlVXJsOiBzdHJpbmcpOiBIdG1sUGFyc2VUcmVlUmVzdWx0IHtcbiAgICBsZXQgdHJhbnNmb3JtZXIgPSBuZXcgTGVnYWN5SHRtbEFzdFRyYW5zZm9ybWVyKCk7XG4gICAgbGV0IGh0bWxQYXJzZVRyZWVSZXN1bHQgPSBzdXBlci5wYXJzZShzb3VyY2VDb250ZW50LCBzb3VyY2VVcmwpO1xuXG4gICAgbGV0IHJvb3ROb2RlcyA9IGh0bWxQYXJzZVRyZWVSZXN1bHQucm9vdE5vZGVzLm1hcChub2RlID0+IG5vZGUudmlzaXQodHJhbnNmb3JtZXIsIG51bGwpKTtcblxuICAgIHJldHVybiB0cmFuc2Zvcm1lci5yZXdyaXR0ZW5Bc3QubGVuZ3RoID4gMCA/XG4gICAgICAgICAgICAgICBuZXcgSHRtbFBhcnNlVHJlZVJlc3VsdChyb290Tm9kZXMsIGh0bWxQYXJzZVRyZWVSZXN1bHQuZXJyb3JzKSA6XG4gICAgICAgICAgICAgICBodG1sUGFyc2VUcmVlUmVzdWx0O1xuICB9XG59XG4iXX0=