import * as vscode from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind, NotificationType } from 'vscode-languageclient/node';

interface KarinaServerConfig {
	logLevel: string;
}
let settings: KarinaServerConfig = {
	logLevel: 'basic'
};

const SendToTerminal = new NotificationType<string>('karina/sendToTerminal');
const ClearTerminal = new NotificationType<void>('karina/clearTerminal');

let client: LanguageClient | null = null;
export function activate(context: vscode.ExtensionContext) {

	const config = vscode.workspace.getConfiguration();
	const server = config.get<string>('karina.lspLocation', '');
	settings.logLevel = config.get<string>('karina.logLevel', 'basic');

	let sendRun = vscode.commands.registerCommand('karina.run.file', () => {
		sendRunCommand();
	});

	let restartLSPCommand = vscode.commands.registerCommand('karina.restart-lsp', () => {
		startLsp();
	});
	
	let stopLSPCommand = vscode.commands.registerCommand('karina.toggle-lsp', () => {
		if (isLSPRunning()) {
			stopLSP();
		} else {
			startLsp();
		}
	});
	context.subscriptions.push(restartLSPCommand);
	context.subscriptions.push(sendRun);
	context.subscriptions.push(stopLSPCommand);
	let watchers = lspLocationWatcher();
	watchers.forEach(watcher => context.subscriptions.push(watcher));

	let statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	statusBar.tooltip = 'Karina LSP (stopped)';
	statusBar.text = '$(close) Karina LSP';
	statusBar.command = 'karina.toggle-lsp';
	context.subscriptions.push(statusBar);
	statusBar.show();
	const updateInterval = setInterval(() => {
		let isRunning = isLSPRunning();
		if (isRunning) {
			statusBar.tooltip = 'Karina LSP (running)';
			statusBar.text = '$(light-bulb) Karina LSP';
		} else {
			statusBar.tooltip = 'Karina LSP (stopped)';
			statusBar.text = '$(close) Karina LSP';
		}

	}, 1000); 

	let lastTerminal: vscode.Pseudoterminal | undefined = undefined;
	const taskProvider = vscode.tasks.registerTaskProvider('karina.run', {
	provideTasks: () => {
    	return [];
	},
	resolveTask(_task: vscode.Task): vscode.Task | undefined {
		if (_task.presentationOptions) {
			_task.presentationOptions.close = true;
		} else {
			_task.presentationOptions = { close: true };
		}
		const definition: KarinaRunTaskDefinition = <any>_task.definition;
		const writeEmitter = new vscode.EventEmitter<string>();
		const task = new vscode.Task(
			definition,
			_task.scope ?? vscode.TaskScope.Workspace,
			"karina.run " + _task.definition.path,
			'karina',
			new vscode.CustomExecution(async (): Promise<vscode.Pseudoterminal> => {
				const closeEmitter = new vscode.EventEmitter<void>();
				let terminal: vscode.Pseudoterminal = {
					onDidClose: closeEmitter.event,
					onDidWrite: writeEmitter.event,
					open: async (initialDimensions) => {
						writeEmitter.fire(`Running Karina task: ${ _task.definition.path }\n`);
						sendRunCommandForPath(_task.definition.path);
						closeEmitter.fire();
					},
					close: () => {
						closeEmitter.fire();
					}
				};
				lastTerminal = terminal;
				return terminal;
			})
		);
		return task;
	}
	});
	context.subscriptions.push(taskProvider);

	context.subscriptions.push({
		dispose: () => clearInterval(updateInterval)
	});

	const watcher = vscode.workspace.createFileSystemWatcher('**/karina-build.json');

    watcher.onDidChange(uri => {
        vscode.window.showInformationMessage(`Restarting Karina LSP`);
        startLsp();
    });

    watcher.onDidCreate(uri => {
        vscode.window.showInformationMessage(`Restarting Karina LSP`);
		startLsp();
    });

    watcher.onDidDelete(uri => {
        vscode.window.showInformationMessage(`Restarting Karina LSP`);
		startLsp();
    });

    
    context.subscriptions.push(watcher);


	startLsp();
	updateServerSettings();
	setTimeout(() => {
		updateServerSettings();
	}, 5000);
}

async function sendRunCommand() {
	if (!isLSPRunning()) {
		startLsp();
	} 

	if (client) {
		const uri = vscode.window.activeTextEditor?.document.uri.toString();
		await client.sendRequest('workspace/executeCommand', {
			command: 'karina.run.file',
			arguments: [uri]
		});
	}
}

async function sendRunCommandForPath(main: string | undefined) {
	if (!main) {
		return;	
	}
	if (!isLSPRunning()) {
		startLsp();
	} 

	if (client) {
		await client.sendRequest('workspace/executeCommand', {
			command: 'karina.run',
			arguments: [main]
		});
	}
}

function isLSPRunning(): boolean {
	return client !== null && client.isRunning();
}

function stopLSP() {
	if (client) {
		client.stop();
		client = null;
	}
}

function lspLocationWatcher(): Array<vscode.Disposable> {
	return [
		vscode.workspace.onDidChangeConfiguration((e) => {
			if (e.affectsConfiguration('karina.lspLocation')) {
				startLsp();
				vscode.window.showInformationMessage('Karina LSP location has been updated.');
			}
			if (e.affectsConfiguration('karina.logLevel')) {
				const config = vscode.workspace.getConfiguration();
				const level = config.get<string>('karina.logLevel', 'basic');
				settings.logLevel = level;
				updateServerSettings();
				vscode.window.showInformationMessage('Log level has been updated.');
			}
		}),

	];
}

function updateServerSettings() {
	if (client) {
		client.sendNotification('workspace/didChangeConfiguration', 
			{
				settings: settings
			}
		);
	}
}


let console: vscode.OutputChannel | null = null;
function startLsp() {
	const config = vscode.workspace.getConfiguration();
	const server = config.get<string>('karina.lspLocation', '');


	stopLSP();
	if (!server) {
		vscode.window.showErrorMessage(
			'Karina LSP location is not set. Please set it in settings.',
			'Open Settings'
		).then(selection => {
			if (selection === 'Open Settings') {
				vscode.commands.executeCommand(
					'workbench.action.openSettings',
					'karina.lspLocation'
				);
			}
		});
		return;
	}

	const serverOptions: ServerOptions = {
		command: 'java',
		args: ['-jar', server],
		transport: TransportKind.stdio
	};

	const clientOptions: LanguageClientOptions = {
		documentSelector: [{ scheme: 'file', language: 'karina' }]
	};

	client = new LanguageClient('karinaLanguageServer', 'Karina Language Server', serverOptions, clientOptions);

	client.start();

	if (console) {
		console.dispose();
		console = null;
	}

	
	client.onNotification(SendToTerminal, async (text) => {
		if (!console) {
			console = vscode.window.createOutputChannel("Karina");
		}
		console.show(true);
		console.appendLine(text || '');
	});

	
	client.onNotification(ClearTerminal, async (text) => {
		if (console) {
			console.clear();
		}
	});

}


export function deactivate() {

	if (!client) {
		return undefined;
	}
	return client.stop();
}


interface KarinaRunTaskDefinition extends vscode.TaskDefinition {

  path?: string;

}