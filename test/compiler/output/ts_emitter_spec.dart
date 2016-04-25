library angular2.test.compiler.output.ts_emitter_spec;

import "package:angular2/testing_internal.dart"
    show
        AsyncTestCompleter,
        beforeEach,
        ddescribe,
        describe,
        el,
        expect,
        iit,
        inject,
        it,
        xit,
        TestComponentBuilder;
import "package:angular2/src/facade/lang.dart" show isBlank;
import "package:angular2/src/compiler/output/ts_emitter.dart"
    show TypeScriptEmitter;
import "package:angular2/src/compiler/compile_metadata.dart"
    show CompileIdentifierMetadata;
import "package:angular2/src/compiler/output/output_ast.dart" as o;

var someModuleUrl = "asset:somePackage/lib/somePath";
var anotherModuleUrl = "asset:somePackage/lib/someOtherPath";
var sameModuleIdentifier = new CompileIdentifierMetadata(
    name: "someLocalId", moduleUrl: someModuleUrl);
var externalModuleIdentifier = new CompileIdentifierMetadata(
    name: "someExternalId", moduleUrl: anotherModuleUrl);
main() {
  // Note supported features of our OutputAstin TS:

  // - real `const` like in Dart

  // - final fields
  describe("TypeScriptEmitter", () {
    TypeScriptEmitter emitter;
    o.ReadVarExpr someVar;
    beforeEach(() {
      emitter = new TypeScriptEmitter();
      someVar = o.variable("someVar");
    });
    String emitStmt(o.Statement stmt, [List<String> exportedVars = null]) {
      if (isBlank(exportedVars)) {
        exportedVars = [];
      }
      return emitter.emitStatements(someModuleUrl, [stmt], exportedVars);
    }
    it("should declare variables", () {
      expect(emitStmt(someVar.set(o.literal(1)).toDeclStmt()))
          .toEqual('''var someVar = 1;''');
      expect(emitStmt(someVar.set(o.literal(1)).toDeclStmt(
          null, [o.StmtModifier.Final]))).toEqual('''const someVar = 1;''');
      expect(emitStmt(someVar.set(o.literal(1)).toDeclStmt(), ["someVar"]))
          .toEqual('''export var someVar = 1;''');
      expect(emitStmt(someVar.set(o.literal(1)).toDeclStmt(o.INT_TYPE)))
          .toEqual('''var someVar:number = 1;''');
    });
    it("should read and write variables", () {
      expect(emitStmt(someVar.toStmt())).toEqual('''someVar;''');
      expect(emitStmt(someVar.set(o.literal(1)).toStmt()))
          .toEqual('''someVar = 1;''');
      expect(emitStmt(someVar
              .set(o.variable("someOtherVar").set(o.literal(1)))
              .toStmt()))
          .toEqual('''someVar = (someOtherVar = 1);''');
    });
    it("should read and write keys", () {
      expect(emitStmt(
              o.variable("someMap").key(o.variable("someKey")).toStmt()))
          .toEqual('''someMap[someKey];''');
      expect(emitStmt(o
              .variable("someMap")
              .key(o.variable("someKey"))
              .set(o.literal(1))
              .toStmt()))
          .toEqual('''someMap[someKey] = 1;''');
    });
    it("should read and write properties", () {
      expect(emitStmt(o.variable("someObj").prop("someProp").toStmt()))
          .toEqual('''someObj.someProp;''');
      expect(emitStmt(o
              .variable("someObj")
              .prop("someProp")
              .set(o.literal(1))
              .toStmt()))
          .toEqual('''someObj.someProp = 1;''');
    });
    it("should invoke functions and methods and constructors", () {
      expect(emitStmt(o.variable("someFn").callFn([o.literal(1)]).toStmt()))
          .toEqual("someFn(1);");
      expect(emitStmt(o
              .variable("someObj")
              .callMethod("someMethod", [o.literal(1)]).toStmt()))
          .toEqual("someObj.someMethod(1);");
      expect(emitStmt(
              o.variable("SomeClass").instantiate([o.literal(1)]).toStmt()))
          .toEqual("new SomeClass(1);");
    });
    it("should support builtin methods", () {
      expect(emitStmt(o.variable("arr1").callMethod(
              o.BuiltinMethod.ConcatArray, [o.variable("arr2")]).toStmt()))
          .toEqual("arr1.concat(arr2);");
      expect(emitStmt(o.variable("observable").callMethod(
              o.BuiltinMethod.SubscribeObservable,
              [o.variable("listener")]).toStmt()))
          .toEqual("observable.subscribe(listener);");
      expect(emitStmt(o.variable("fn").callMethod(
              o.BuiltinMethod.bind, [o.variable("someObj")]).toStmt()))
          .toEqual("fn.bind(someObj);");
    });
    it("should support literals", () {
      expect(emitStmt(o.literal(0).toStmt())).toEqual("0;");
      expect(emitStmt(o.literal(true).toStmt())).toEqual("true;");
      expect(emitStmt(o.literal("someStr").toStmt()))
          .toEqual('''\'someStr\';''');
      expect(emitStmt(o.literalArr([o.literal(1)]).toStmt()))
          .toEqual('''[1];''');
      expect(emitStmt(o.literalMap([
        ["someKey", o.literal(1)]
      ]).toStmt()))
          .toEqual('''{\'someKey\': 1};''');
    });
    it("should support external identifiers", () {
      expect(emitStmt(o.importExpr(sameModuleIdentifier).toStmt()))
          .toEqual("someLocalId;");
      expect(emitStmt(o.importExpr(externalModuleIdentifier).toStmt()))
          .toEqual([
        '''import * as import0 from \'./someOtherPath\';''',
        '''import0.someExternalId;'''
      ].join("\n"));
    });
    it("should support operators", () {
      var lhs = o.variable("lhs");
      var rhs = o.variable("rhs");
      expect(emitStmt(someVar.cast(o.INT_TYPE).toStmt()))
          .toEqual("(<number>someVar);");
      expect(emitStmt(o.not(someVar).toStmt())).toEqual("!someVar;");
      expect(emitStmt(someVar
              .conditional(o.variable("trueCase"), o.variable("falseCase"))
              .toStmt()))
          .toEqual("someVar? trueCase: falseCase;");
      expect(emitStmt(lhs.equals(rhs).toStmt())).toEqual("(lhs == rhs);");
      expect(emitStmt(lhs.notEquals(rhs).toStmt())).toEqual("(lhs != rhs);");
      expect(emitStmt(lhs.identical(rhs).toStmt())).toEqual("(lhs === rhs);");
      expect(emitStmt(lhs.notIdentical(rhs).toStmt()))
          .toEqual("(lhs !== rhs);");
      expect(emitStmt(lhs.minus(rhs).toStmt())).toEqual("(lhs - rhs);");
      expect(emitStmt(lhs.plus(rhs).toStmt())).toEqual("(lhs + rhs);");
      expect(emitStmt(lhs.divide(rhs).toStmt())).toEqual("(lhs / rhs);");
      expect(emitStmt(lhs.multiply(rhs).toStmt())).toEqual("(lhs * rhs);");
      expect(emitStmt(lhs.modulo(rhs).toStmt())).toEqual("(lhs % rhs);");
      expect(emitStmt(lhs.and(rhs).toStmt())).toEqual("(lhs && rhs);");
      expect(emitStmt(lhs.or(rhs).toStmt())).toEqual("(lhs || rhs);");
      expect(emitStmt(lhs.lower(rhs).toStmt())).toEqual("(lhs < rhs);");
      expect(emitStmt(lhs.lowerEquals(rhs).toStmt())).toEqual("(lhs <= rhs);");
      expect(emitStmt(lhs.bigger(rhs).toStmt())).toEqual("(lhs > rhs);");
      expect(emitStmt(lhs.biggerEquals(rhs).toStmt())).toEqual("(lhs >= rhs);");
    });
    it("should support function expressions", () {
      expect(emitStmt(o.fn([], []).toStmt()))
          .toEqual(["():void => {", "};"].join("\n"));
      expect(emitStmt(o.fn(
              [], [new o.ReturnStatement(o.literal(1))], o.INT_TYPE).toStmt()))
          .toEqual(["():number => {", "  return 1;\n};"].join("\n"));
      expect(emitStmt(o.fn([new o.FnParam("param1", o.INT_TYPE)], []).toStmt()))
          .toEqual(["(param1:number):void => {", "};"].join("\n"));
    });
    it("should support function statements", () {
      expect(emitStmt(new o.DeclareFunctionStmt("someFn", [], [])))
          .toEqual(["function someFn():void {", "}"].join("\n"));
      expect(emitStmt(new o.DeclareFunctionStmt("someFn", [], []), ["someFn"]))
          .toEqual(["export function someFn():void {", "}"].join("\n"));
      expect(emitStmt(new o.DeclareFunctionStmt(
              "someFn", [], [new o.ReturnStatement(o.literal(1))], o.INT_TYPE)))
          .toEqual(
              ["function someFn():number {", "  return 1;", "}"].join("\n"));
      expect(emitStmt(new o.DeclareFunctionStmt(
              "someFn", [new o.FnParam("param1", o.INT_TYPE)], [])))
          .toEqual(["function someFn(param1:number):void {", "}"].join("\n"));
    });
    it("should support comments", () {
      expect(emitStmt(new o.CommentStmt("a\nb")))
          .toEqual(["// a", "// b"].join("\n"));
    });
    it("should support if stmt", () {
      var trueCase = o.variable("trueCase").callFn([]).toStmt();
      var falseCase = o.variable("falseCase").callFn([]).toStmt();
      expect(emitStmt(new o.IfStmt(o.variable("cond"), [trueCase])))
          .toEqual(["if (cond) { trueCase(); }"].join("\n"));
      expect(emitStmt(
          new o.IfStmt(o.variable("cond"), [trueCase], [falseCase]))).toEqual([
        "if (cond) {",
        "  trueCase();",
        "} else {",
        "  falseCase();",
        "}"
      ].join("\n"));
    });
    it("should support try/catch", () {
      var bodyStmt = o.variable("body").callFn([]).toStmt();
      var catchStmt = o
          .variable("catchFn")
          .callFn([o.CATCH_ERROR_VAR, o.CATCH_STACK_VAR]).toStmt();
      expect(emitStmt(new o.TryCatchStmt([bodyStmt], [catchStmt]))).toEqual([
        "try {",
        "  body();",
        "} catch (error) {",
        "  const stack = error.stack;",
        "  catchFn(error,stack);",
        "}"
      ].join("\n"));
    });
    it("should support support throwing", () {
      expect(emitStmt(new o.ThrowStmt(someVar))).toEqual("throw someVar;");
    });
    describe("classes", () {
      o.Statement callSomeMethod;
      beforeEach(() {
        callSomeMethod = o.THIS_EXPR.callMethod("someMethod", []).toStmt();
      });
      it("should support declaring classes", () {
        expect(emitStmt(new o.ClassStmt("SomeClass", null, [], [], null, [])))
            .toEqual(["class SomeClass {", "}"].join("\n"));
        expect(emitStmt(new o.ClassStmt("SomeClass", null, [], [], null, []), [
          "SomeClass"
        ])).toEqual(["export class SomeClass {", "}"].join("\n"));
        expect(emitStmt(new o.ClassStmt(
                "SomeClass", o.variable("SomeSuperClass"), [], [], null, [])))
            .toEqual(
                ["class SomeClass extends SomeSuperClass {", "}"].join("\n"));
      });
      it("should support declaring constructors", () {
        var superCall = o.SUPER_EXPR.callFn([o.variable("someParam")]).toStmt();
        expect(emitStmt(
            new o.ClassStmt("SomeClass", null, [], [],
                new o.ClassMethod(null, [], []), []))).toEqual(
            ["class SomeClass {", "  constructor() {", "  }", "}"].join("\n"));
        expect(emitStmt(new o.ClassStmt(
            "SomeClass",
            null,
            [],
            [],
            new o.ClassMethod(
                null, [new o.FnParam("someParam", o.INT_TYPE)], []),
            []))).toEqual([
          "class SomeClass {",
          "  constructor(someParam:number) {",
          "  }",
          "}"
        ].join("\n"));
        expect(emitStmt(new o.ClassStmt("SomeClass", null, [], [],
            new o.ClassMethod(null, [], [superCall]), []))).toEqual([
          "class SomeClass {",
          "  constructor() {",
          "    super(someParam);",
          "  }",
          "}"
        ].join("\n"));
        expect(emitStmt(new o.ClassStmt("SomeClass", null, [], [],
            new o.ClassMethod(null, [], [callSomeMethod]), []))).toEqual([
          "class SomeClass {",
          "  constructor() {",
          "    this.someMethod();",
          "  }",
          "}"
        ].join("\n"));
      });
      it("should support declaring fields", () {
        expect(emitStmt(new o.ClassStmt("SomeClass", null,
                [new o.ClassField("someField")], [], null, [])))
            .toEqual(["class SomeClass {", "  someField;", "}"].join("\n"));
        expect(emitStmt(new o.ClassStmt("SomeClass", null,
                [new o.ClassField("someField", o.INT_TYPE)], [], null, [])))
            .toEqual(
                ["class SomeClass {", "  someField:number;", "}"].join("\n"));
        expect(emitStmt(new o.ClassStmt(
            "SomeClass",
            null,
            [
              new o.ClassField(
                  "someField", o.INT_TYPE, [o.StmtModifier.Private])
            ],
            [],
            null,
            []))).toEqual([
          "class SomeClass {",
          "  private someField:number;",
          "}"
        ].join("\n"));
      });
      it("should support declaring getters", () {
        expect(emitStmt(new o.ClassStmt("SomeClass", null, [],
            [new o.ClassGetter("someGetter", [])], null, []))).toEqual([
          "class SomeClass {",
          "  get someGetter() {",
          "  }",
          "}"
        ].join("\n"));
        expect(emitStmt(new o.ClassStmt(
            "SomeClass",
            null,
            [],
            [new o.ClassGetter("someGetter", [], o.INT_TYPE)],
            null,
            []))).toEqual([
          "class SomeClass {",
          "  get someGetter():number {",
          "  }",
          "}"
        ].join("\n"));
        expect(emitStmt(new o.ClassStmt(
            "SomeClass",
            null,
            [],
            [
              new o.ClassGetter("someGetter", [callSomeMethod])
            ],
            null,
            []))).toEqual([
          "class SomeClass {",
          "  get someGetter() {",
          "    this.someMethod();",
          "  }",
          "}"
        ].join("\n"));
        expect(emitStmt(new o.ClassStmt(
            "SomeClass",
            null,
            [],
            [
              new o.ClassGetter(
                  "someGetter", [], null, [o.StmtModifier.Private])
            ],
            null,
            []))).toEqual([
          "class SomeClass {",
          "  private get someGetter() {",
          "  }",
          "}"
        ].join("\n"));
      });
      it("should support methods", () {
        expect(emitStmt(new o.ClassStmt("SomeClass", null, [], [], null,
            [new o.ClassMethod("someMethod", [], [])]))).toEqual([
          "class SomeClass {",
          "  someMethod():void {",
          "  }",
          "}"
        ].join("\n"));
        expect(emitStmt(new o.ClassStmt("SomeClass", null, [], [], null,
            [new o.ClassMethod("someMethod", [], [], o.INT_TYPE)]))).toEqual([
          "class SomeClass {",
          "  someMethod():number {",
          "  }",
          "}"
        ].join("\n"));
        expect(emitStmt(new o.ClassStmt(
            "SomeClass",
            null,
            [],
            [],
            null,
            [
              new o.ClassMethod(
                  "someMethod", [new o.FnParam("someParam", o.INT_TYPE)], [])
            ]))).toEqual([
          "class SomeClass {",
          "  someMethod(someParam:number):void {",
          "  }",
          "}"
        ].join("\n"));
        expect(emitStmt(new o.ClassStmt(
            "SomeClass",
            null,
            [],
            [],
            null,
            [
              new o.ClassMethod("someMethod", [], [callSomeMethod])
            ]))).toEqual([
          "class SomeClass {",
          "  someMethod():void {",
          "    this.someMethod();",
          "  }",
          "}"
        ].join("\n"));
      });
    });
    it("should support builtin types", () {
      var writeVarExpr = o.variable("a").set(o.NULL_EXPR);
      expect(emitStmt(writeVarExpr.toDeclStmt(o.DYNAMIC_TYPE)))
          .toEqual("var a:any = null;");
      expect(emitStmt(writeVarExpr.toDeclStmt(o.BOOL_TYPE)))
          .toEqual("var a:boolean = null;");
      expect(emitStmt(writeVarExpr.toDeclStmt(o.INT_TYPE)))
          .toEqual("var a:number = null;");
      expect(emitStmt(writeVarExpr.toDeclStmt(o.NUMBER_TYPE)))
          .toEqual("var a:number = null;");
      expect(emitStmt(writeVarExpr.toDeclStmt(o.STRING_TYPE)))
          .toEqual("var a:string = null;");
      expect(emitStmt(writeVarExpr.toDeclStmt(o.FUNCTION_TYPE)))
          .toEqual("var a:Function = null;");
    });
    it("should support external types", () {
      var writeVarExpr = o.variable("a").set(o.NULL_EXPR);
      expect(emitStmt(
              writeVarExpr.toDeclStmt(o.importType(sameModuleIdentifier))))
          .toEqual("var a:someLocalId = null;");
      expect(emitStmt(
              writeVarExpr.toDeclStmt(o.importType(externalModuleIdentifier))))
          .toEqual([
        '''import * as import0 from \'./someOtherPath\';''',
        '''var a:import0.someExternalId = null;'''
      ].join("\n"));
    });
    it("should support combined types", () {
      var writeVarExpr = o.variable("a").set(o.NULL_EXPR);
      expect(emitStmt(writeVarExpr.toDeclStmt(new o.ArrayType(null))))
          .toEqual("var a:any[] = null;");
      expect(emitStmt(writeVarExpr.toDeclStmt(new o.ArrayType(o.INT_TYPE))))
          .toEqual("var a:number[] = null;");
      expect(emitStmt(writeVarExpr.toDeclStmt(new o.MapType(null))))
          .toEqual("var a:{[key: string]:any} = null;");
      expect(emitStmt(writeVarExpr.toDeclStmt(new o.MapType(o.INT_TYPE))))
          .toEqual("var a:{[key: string]:number} = null;");
    });
  });
}
