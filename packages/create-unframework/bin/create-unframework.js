#!/usr/bin/env node
import { main } from "create-unframework";

process.exitCode = main(process.argv.slice(2));
