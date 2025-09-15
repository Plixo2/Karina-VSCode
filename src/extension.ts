import * as vscode from 'vscode';
import * as fs from 'fs';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind, NotificationType } from 'vscode-languageclient/node';

interface KarinaServerConfig {
	logLevel: string;
}
let settings: KarinaServerConfig = {
	logLevel: 'basic'
};


let client: LanguageClient | null = null;
export function activate(context: vscode.ExtensionContext) {

	const config = vscode.workspace.getConfiguration();
	settings.logLevel = config.get<string>('karina.logLevel', 'basic');

	let sendRun = vscode.commands.registerCommand('karina.run.main', () => {
		sendRunCommand();
	});

	let sendRunFile = vscode.commands.registerCommand('karina.run.file', () => {
		sendRunFileCommand();
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
	context.subscriptions.push(sendRunFile);
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

	context.subscriptions.push({
		dispose: () => clearInterval(updateInterval)
	});

	const watcher = vscode.workspace.createFileSystemWatcher('**/karina-build.json');

	watcher.onDidChange(uri => {
		startLsp();
	});

	watcher.onDidCreate(uri => {
		startLsp();
	});

	watcher.onDidDelete(uri => {
		startLsp();
	});


	context.subscriptions.push(watcher);


	startLsp();
	updateServerSettings();
	setTimeout(() => {
		updateServerSettings();
	}, 5000);
}

let lastTerminal: vscode.Terminal | null = null;

async function sendRunCommand() {
	if (!isLSPRunning()) {
		startLsp();
	}

	if (client) {
		await client.sendRequest('workspace/executeCommand', {
			command: 'karina.run.main',
			arguments: []
		});
		if (lastTerminal) {
			lastTerminal.dispose();
		}
		lastTerminal = vscode.window.createTerminal({
			name: 'Karina',
		});
		lastTerminal.show(true);
		lastTerminal.sendText('build/run');
	}


}
async function sendRunFileCommand() {
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


function startLsp() {
	const config = vscode.workspace.getConfiguration();
	const server = config.get<string>('karina.lspLocation', '');


	stopLSP();
	if (!server) {
		showLSPPathError('Karina LSP location is not set. Please set it in settings.');
		return;
	}

	if (!fs.existsSync(server)) {
		showLSPPathError(`Karina LSP location does not exist: ${server}. Please set it in settings.`);
		return;
	}
	vscode.window.showInformationMessage(`Starting Karina Language Server...`);
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

}

function showLSPPathError(message: string) {
	vscode.window.showErrorMessage(
		message,
		'Open Settings',
		'Download'
	).then(selection => {
		if (selection === 'Open Settings') {
			vscode.commands.executeCommand(
				'workbench.action.openSettings',
				'karina.lspLocation'
			);
		} else if (selection === 'Download') {
			vscode.env.openExternal(
				vscode.Uri.parse("https://github.com/Plixo2/KarinaC/releases/latest/download/karina-lsp.jar")
			);
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