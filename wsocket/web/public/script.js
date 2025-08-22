class TicTacToeGame {
	constructor() {
		this.socket = io()
		this.gameId = null
		this.playerIndex = null
		this.playerName = ''
		this.opponentName = ''
		this.playerSymbol = ''
		this.gameState = null

		this.initializeElements()
		this.setupEventListeners()
		this.setupSocketListeners()
	}

	initializeElements() {
		this.nameScreen = document.getElementById('nameScreen')
		this.waitingScreen = document.getElementById('waitingScreen')
		this.gameScreen = document.getElementById('gameScreen')
		this.disconnectScreen = document.getElementById('disconnectScreen')

		this.playerNameInput = document.getElementById('playerName')
		this.searchBtn = document.getElementById('searchBtn')

		this.currentPlayerEl = document.getElementById('currentPlayer')
		this.opponentEl = document.getElementById('opponent')
		this.playerSymbolEl = document.getElementById('playerSymbol')
		this.turnStatusEl = document.getElementById('turnStatus')
		this.gameBoard = document.getElementById('gameBoard')
		this.restartBtn = document.getElementById('restartBtn')

		this.gameOverModal = document.getElementById('gameOverModal')
		this.gameResultEl = document.getElementById('gameResult')
		this.playAgainBtn = document.getElementById('playAgainBtn')
		this.backToMenuBtn = document.getElementById('backToMenuBtn')
		this.backToMenuModalBtn = document.getElementById('backToMenuModalBtn')

		this.cells = document.querySelectorAll('.cell')
	}

	setupEventListeners() {
		this.searchBtn.addEventListener('click', () => this.searchForPlayer())
		this.playerNameInput.addEventListener('keypress', e => {
			if (e.key === 'Enter') this.searchForPlayer()
		})

		this.cells.forEach(cell => {
			cell.addEventListener('click', e => this.makeMove(e))
		})

		this.restartBtn.addEventListener('click', () => this.restartGame())

		this.playAgainBtn.addEventListener('click', () => this.playAgain())
		this.backToMenuBtn.addEventListener('click', () => this.backToMenu())
		this.backToMenuModalBtn.addEventListener('click', () => this.backToMenu())
	}

	setupSocketListeners() {
		this.socket.on('waiting', () => {
			this.showScreen('waitingScreen')
		})

		this.socket.on('gameFound', data => {
			this.gameId = data.gameId
			this.playerIndex = data.playerIndex
			this.opponentName = data.opponent
			this.playerSymbol = data.symbol
			this.gameState = data.gameState

			this.updateGameInfo()
			this.showScreen('gameScreen')
		})

		this.socket.on('gameUpdate', gameState => {
			this.gameState = gameState
			this.updateBoard()
			this.updateTurnStatus()

			if (gameState.gameStatus === 'finished') {
				this.handleGameEnd()
			}
		})

		this.socket.on('opponentDisconnected', () => {
			this.showScreen('disconnectScreen')
			this.hideModal()
		})

		this.socket.on('invalidMove', message => {
			this.showMessage(message, 'error')
		})

		this.socket.on('error', message => {
			this.showMessage(message, 'error')
		})
	}

	searchForPlayer() {
		const name = this.playerNameInput.value.trim()
		if (!name) {
			this.showMessage('Iltimos, ismingizni kiriting', 'error')
			return
		}

		this.playerName = name
		this.socket.emit('searchPlayer', name)
	}

	makeMove(event) {
		const cell = event.target
		const position = parseInt(cell.dataset.index)

		if (
			!this.gameState ||
			this.gameState.gameStatus !== 'playing' ||
			this.gameState.currentPlayer !== this.playerIndex ||
			this.gameState.board[position] !== null
		) {
			return
		}

		this.socket.emit('makeMove', {
			gameId: this.gameId,
			position: position,
		})
	}

	restartGame() {
		this.socket.emit('restartGame', this.gameId)
		this.restartBtn.style.display = 'none'
	}

	playAgain() {
		this.restartGame()
		this.hideModal()
	}

	backToMenu() {
		this.resetGame()
		this.showScreen('nameScreen')
		this.hideModal()
	}

	updateGameInfo() {
		this.currentPlayerEl.textContent = `You : ${this.playerName}`
		this.opponentEl.textContent = `Opponent : ${this.opponentName}`
		this.playerSymbolEl.textContent = `You are playing as ${this.playerSymbol}`
	}

	updateBoard() {
		this.cells.forEach((cell, index) => {
			const cellValue = this.gameState.board[index]
			cell.textContent = cellValue || ''

			cell.classList.remove('x', 'o', 'disabled')

			if (cellValue === 'X') {
				cell.classList.add('x')
			} else if (cellValue === 'O') {
				cell.classList.add('o')
			}

			if (
				this.gameState.gameStatus !== 'playing' ||
				this.gameState.currentPlayer !== this.playerIndex ||
				cellValue !== null
			) {
				cell.classList.add('disabled')
			}
		})
	}

	updateTurnStatus() {
		if (!this.gameState) return

		const currentSymbol = this.gameState.currentPlayer === 0 ? 'X' : 'O'
		const isMyTurn = this.gameState.currentPlayer === this.playerIndex

		if (this.gameState.gameStatus === 'playing') {
			if (isMyTurn) {
				this.turnStatusEl.textContent = 'Sizning navbatingiz'
				this.turnStatusEl.style.color = '#4CAF50'
			} else {
				this.turnStatusEl.textContent = `${currentSymbol}'s Turn`
				this.turnStatusEl.style.color = '#2196F3'
			}
		}
	}

	handleGameEnd() {
		let message = ''
		let messageClass = ''

		if (this.gameState.winner === 'draw') {
			message = 'Durrang!'
			messageClass = 'draw'
		} else if (this.gameState.winner === this.playerIndex) {
			message = 'Siz yutdingiz! 🎉'
			messageClass = 'win'
		} else {
			message = 'Siz yutqazdingiz 😔'
			messageClass = 'lose'
		}

		this.turnStatusEl.textContent = "O'yin tugadi"
		this.turnStatusEl.style.color = '#666'

		this.restartBtn.style.display = 'inline-block'

		setTimeout(() => {
			this.showGameOverModal(message, messageClass)
		}, 1000)
	}

	showGameOverModal(message, messageClass) {
		this.gameResultEl.textContent = message
		this.gameResultEl.className = messageClass
		this.gameOverModal.classList.add('active')
	}

	hideModal() {
		this.gameOverModal.classList.remove('active')
	}

	showScreen(screenId) {
		document.querySelectorAll('.screen').forEach(screen => {
			screen.classList.remove('active')
		})

		document.getElementById(screenId).classList.add('active')
	}

	showMessage(message, type = 'info') {
		console.log(`${type.toUpperCase()}: ${message}`)

		const alertClass = type === 'error' ? 'alert-error' : 'alert-info'

		const messageEl = document.createElement('div')
		messageEl.className = `message ${alertClass}`
		messageEl.textContent = message
		messageEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'error' ? '#f44336' : '#2196F3'};
            color: white;
            padding: 15px 20px;
            border-radius: 10px;
            z-index: 2000;
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
        `

		document.body.appendChild(messageEl)

		setTimeout(() => {
			if (messageEl.parentNode) {
				messageEl.parentNode.removeChild(messageEl)
			}
		}, 3000)
	}

	resetGame() {
		this.gameId = null
		this.playerIndex = null
		this.playerName = ''
		this.opponentName = ''
		this.playerSymbol = ''
		this.gameState = null

		this.playerNameInput.value = ''

		this.cells.forEach(cell => {
			cell.textContent = ''
			cell.classList.remove('x', 'o', 'disabled')
		})

		this.restartBtn.style.display = 'none'
		this.turnStatusEl.textContent = ''
		this.currentPlayerEl.textContent = 'You : '
		this.opponentEl.textContent = 'Opponent : '
		this.playerSymbolEl.textContent = 'You are playing as X'

		this.hideModal()
	}
}

document.addEventListener('DOMContentLoaded', () => {
	new TicTacToeGame()
})

window.addEventListener('beforeunload', () => {})
