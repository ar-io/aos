# aos 

This is the source code to the aos module, this module provides developers with the capability of designing and building process on the ao network in an interactive experience. When the design is complete the developer can transfer the ownership to a DAO process or brick the ownership so that the process can never be modified.

## Build

```sh
yarn build
```

## Testing

```sh
yarn test
```

## Modules

- [process](process.md)
- [handlers](handlers.md)
- [ao](ao.md)


## AR.IO PROCESS DEPLOYMENT

The source code for the AR.IO process is located in the [ar-io-network-process](https://github.com/ar-io/ar-io-network-process) repository.

The initial bootstrap state files are located in the [ar-io-mainnet-csvs](https://github.com/ar-io/ar-io-mainnet-csvs) repository.

This repository contains a script that clones these repositories and copies the necessary files into this repository so that the AR.IO process can be built and published.

It also modified the `process.lua` file to work with the AR.IO process, while removing unnecessary code and adds happy path end to end tests against the produced process.wasm file.

### Module Configuration

The module configuration can be found in config.yaml. It contains the following:

```yaml
stack_size: 33554432 # 32Mib of stack
initial_memory: 50331648 # 48Mib of initial memory
maximum_memory: 8589934592 # 8Gib of maximum memory
target: 64 # wasm 64 target
```

### Creating a new AR.IO process from scratch

```bash
./publish.sh --reset --dry-run
```

This will clone the AR.IO source code and state files, build the process, and run the tests. It **WILL NOT** publish the module to the network or create a process.

The result will be a `process.wasm` file that can be published to the network and inspected.

### Publishing the module to the network

```bash
./publish.sh # add --reset to fetch process src code and state files
```

This will publish the module to the network and create a process. It will then open that process in the `aos` CLI.

Note: `./publish.sh` creates the module with the following commands:
```bash
ao publish -w ./wallet.json ./process.wasm \
  -t Compute-Limit -v 9000000000000 \
  -t Memory-Limit -v 17179869184 \
  --bundler https://up.arweave.net
```

Modify the `./publish.sh` script to change the module name and format as needed.

### Ticking State

Once the process is created - it's essential to validate the ticking mechanism is working as expected. To do so, you can set the following on the created AR.IO process from the aos console:

```bash
> aos ario-mainnet -w ./wallet.json --module=$MODULE_ID --cu-url https://cu.ar-io.dev \
  --tag-name Execution-Device --tag-value genesis-wasm@1.0 \
  --tag-name Scheduler-Device --tag-value scheduler@1.0 \
  --tag-name Device --tag-value process@1.0
```

Once the process is created - you can use the following command to update the state and start ticking epochs:

```bash
default@aos-2.0.3[Inbox:0]> .editor
<editor mode> use '.done' to submit or '.cancel' to cancel
-- update the start timestamp for all gateways
for address, gateway in pairs(GatewayRegistry) do
  gateway.startTimestamp = 1739934000000
end
-- update the epoch settings to start the epochs
EpochSettings.epochZeroStartTimestamp = 1739934000000
-- shorten the epoch duration for rapid live testing
EpochSettings.durationMs = 300000
.done
```

Next - you'll need to create a separate process to tick the state. Align the tick interval with the epoch duration. Once the handler is added, be sure to run `.monitor` in aos to enable the ticking. Ideally this is done at the approximate minute mark of the epoch.

```bash
> aos --cron 5-minutes
default@aos-2.0.3[Inbox:0]> .editor
Target = Target or "<INSERT PROCESS ID HERE>"
-- handler task to execute on cron message
Handlers.add("cron", "Cron", function() 
  ao.send({ Target = Target, Action = "Tick" })
end)
.done
default@aos-2.0.3[Inbox:0]> .monitor
```

Once created, review [ao.link](https://ao.link) to ensure the process is working as expected. You can also navigate to the network portal https://ar-io-network-portal-a40ee--pr167-process-tester-do-no-sajky343.web.app/#/dashboard to review the process state and epochs.

### Additional Tools

- Once the process is created - you can use the [AR.IO Github Action](https://github.com/ar-io/ar-io-network-process/actions/workflows/monitor_ad_hoc.yaml) to validate the process state. This tests runs e2e tests against the `ar-io-sdk` and inspects invariants in the initial state.
