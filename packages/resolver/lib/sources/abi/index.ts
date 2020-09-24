import path from "path";
import { ContractObject } from "@truffle/contract-schema/spec";

import { FS } from "../fs";
import { describeInterface } from "./visitor";

export class ABI extends FS {
  require(): ContractObject | null {
    return null;
  }

  async resolve(importPath: string, importedFrom: string = "") {
    let filePath: string | undefined;
    let body: string | undefined;

    if (!importPath.endsWith(".json")) {
      return { filePath, body };
    }

    const resolution = await super.resolve(importPath, importedFrom);
    if (!resolution) {
      return { filePath, body };
    }

    ({ filePath, body } = resolution);

    // extract basename twice to support .json and .abi.json
    const contractName = path.basename(
      path.basename(filePath, ".json"),
      ".abi"
    );

    try {
      const abi = JSON.parse(body);

      const soliditySource = describeInterface({ contractName, abi });

      return {
        filePath,
        body: soliditySource
      };
    } catch (e) {
      return { filePath, body };
    }
  }
}
