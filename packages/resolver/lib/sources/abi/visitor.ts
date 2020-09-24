import { Abi as SchemaAbi } from "@truffle/contract-schema/spec";
import * as Codec from "@truffle/codec";
import indentString from "indent-string";

import Abi = Codec.AbiData.Abi;
import AbiEntry = Codec.AbiData.AbiEntry;
import FunctionAbiEntry = Codec.AbiData.FunctionAbiEntry;
import ConstructorAbiEntry = Codec.AbiData.ConstructorAbiEntry;
import FallbackAbiEntry = Codec.AbiData.FallbackAbiEntry;
import ReceiveAbiEntry = Codec.AbiData.ReceiveAbiEntry;
import EventAbiEntry = Codec.AbiData.EventAbiEntry;
import AbiParameter = Codec.AbiData.AbiParameter;

export type Node =
  | Abi
  | AbiEntry
  | FunctionAbiEntry
  | ConstructorAbiEntry
  | FallbackAbiEntry
  | ReceiveAbiEntry
  | EventAbiEntry
  | AbiParameter;

interface AbiWriter {
  writeAbi(node: Abi): string;
  writeAbiEntry(node: AbiEntry): string;
  writeFunctionAbiEntry(node: FunctionAbiEntry): string;
  writeFallbackAbiEntry(node: FallbackAbiEntry): string;
  writeReceiveAbiEntry(node: ReceiveAbiEntry): string;
  writeAbiParameter(node: AbiParameter): string;
}

interface SolidityAbiWriterOptions {
  contractName: string;
}

const indent = (text: string) => indentString(text, 2);

class SolidityAbiWriter implements AbiWriter {
  private contractName: string;

  constructor({ contractName }: SolidityAbiWriterOptions) {
    this.contractName = contractName;
  }

  writeAbi(node: Abi) {
    return [
      `//SPDX-License-Identifier: UNLICENSED`,
      `pragma solidity >=0.5.0 <0.8.0;`,
      ``,
      `interface ${this.contractName} {`,
      node
        .filter(entry => entry.type !== "constructor")
        .filter(entry => entry.type !== "event") // TODO stop filtering these
        .map(entry => `${this.writeAbiEntry(entry)};`)
        .map(indent)
        .join("\n\n"),
      `}`
    ].join("\n");
  }

  writeAbiEntry(node: AbiEntry) {
    switch (node.type) {
      case "function":
        return this.writeFunctionAbiEntry(node);
      case "fallback":
        return this.writeFallbackAbiEntry(node);
      case "receive":
        return this.writeReceiveAbiEntry(node);
    }
  }

  writeModifiers(node: FunctionAbiEntry | FallbackAbiEntry | ReceiveAbiEntry) {
    const mutability = this.writeMutability(node);

    return [
      // functions in solidity interfaces must be external
      `external`,

      ...(mutability && mutability.length > 0 ? [mutability] : [])
    ].join("\n");
  }

  writeMutability(node: FunctionAbiEntry | FallbackAbiEntry | ReceiveAbiEntry) {
    if (node.stateMutability === "payable" || node.payable) {
      return "payable";
    }

    if (!isFunctionAbiEntry(node)) {
      return "";
    }

    if (node.stateMutability === "view" || node.constant) {
      return "view";
    }

    if (node.stateMutability === "pure") {
      return "pure";
    }
  }

  writeFunctionAbiEntry(node: FunctionAbiEntry) {
    return [
      `function ${node.name}(`,
      indent(this.writeInputs(node)),
      `)`,
      indent(this.writeModifiers(node)),
      ...(node.outputs && node.outputs.length > 0
        ? [`returns (`, indent(this.writeOutputs(node)), `)`]
        : []
      ).map(indent)
    ].join("\n");
  }

  writeFallbackAbiEntry(node: FallbackAbiEntry) {
    return [`function ()`, this.writeModifiers(node)].join(" ");
  }

  writeReceiveAbiEntry(node: ReceiveAbiEntry) {
    return `receive () external payable`;
  }

  writeInputs(node: FunctionAbiEntry) {
    return node.inputs
      .map(parameter =>
        parameter.type.indexOf("[") !== -1
          ? { ...parameter, type: `${parameter.type} calldata` }
          : parameter
      )
      .map(parameter => this.writeAbiParameter(parameter))
      .join(",\n");
  }

  writeOutputs(node: FunctionAbiEntry) {
    return node.outputs
      .map(parameter =>
        parameter.type === "string"
          ? { ...parameter, type: "string memory" }
          : parameter
      )
      .map(parameter => this.writeAbiParameter(parameter))
      .join(",\n");
  }

  writeAbiParameter(node: AbiParameter) {
    return `${node.type} ${node.name}`.trim();
  }
}

const isFunctionAbiEntry = (node: AbiEntry): node is FunctionAbiEntry =>
  typeof node === "object" && node.type === "function";

const isConstructorAbiEntry = (node: AbiEntry): node is ConstructorAbiEntry =>
  typeof node === "object" && node.type === "constructor";

const isFallbackAbiEntry = (node: AbiEntry): node is FallbackAbiEntry =>
  typeof node === "object" && node.type === "fallback";

const isReceiveAbiEntry = (node: AbiEntry): node is ReceiveAbiEntry =>
  typeof node === "object" && node.type === "receive";

const isEventAbiEntry = (node: AbiEntry): node is EventAbiEntry =>
  typeof node === "object" && node.type === "event";

export interface DescribeInterfaceOptions {
  contractName: string;
  abi: SchemaAbi;
}

export function describeInterface(options: DescribeInterfaceOptions): string {
  const { contractName, abi: rawAbi } = options;

  const abi = Codec.AbiData.Utils.schemaAbiToAbi(rawAbi);

  const writer = new SolidityAbiWriter({
    contractName
  });

  return writer.writeAbi(abi);
}
