import * as vscode from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient/node';

interface KarinaServerConfig {
	logLevel: string;
}
let settings: KarinaServerConfig = {
	logLevel: 'basic'
};


let client: LanguageClient | null = null;
export function activate(context: vscode.ExtensionContext) {

	const config = vscode.workspace.getConfiguration();
	const server = config.get<string>('karina.lspLocation', '');
	settings.logLevel = config.get<string>('karina.logLevel', 'basic');

	let restartLSPCommand = vscode.commands.registerCommand('karina.restart-lsp', () => {
		startLsp(server);
	});
	
	let stopLSPCommand = vscode.commands.registerCommand('karina.toggle-lsp', () => {
		if (isLSPRunning()) {
			stopLSP();
		} else {
			startLsp(server);
		}
	});
	context.subscriptions.push(restartLSPCommand);
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
        vscode.window.showInformationMessage(`Restarting Karina LSP`);
        startLsp(server);
    });

    watcher.onDidCreate(uri => {
        vscode.window.showInformationMessage(`Restarting Karina LSP`);
		startLsp(server);
    });

    watcher.onDidDelete(uri => {
        vscode.window.showInformationMessage(`Restarting Karina LSP`);
		startLsp(server);
    });

    
    context.subscriptions.push(watcher);


	startLsp(server);
	updateServerSettings();
	setTimeout(() => {
		updateServerSettings();
	}, 5000);
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
				const config = vscode.workspace.getConfiguration();
				const server = config.get<string>('karina.lspLocation', '');
				startLsp(server);
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



function startLsp(server: string) {
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
	

}


export function deactivate() {

	if (!client) {
		return undefined;
	}
	return client.stop();
}
