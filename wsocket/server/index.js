import cors from 'cors'
import express from 'express'
import { createServer } from 'http'
import path from 'path'
import { Server } from 'socket.io'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const server = createServer(app)
const io = new Server(server, {
	cors: {
		origin: '*',
		methods: ['GET', 'POST'],
	},
})

app.use(cors())
app.use(express.static(path.join(__dirname, '../web/public')))

const games = new Map()
const waitingPlayers = []

class Game {
	constructor(player1, player2) {
		this.id = Math.random().toString(36).substr(2, 9)
		this.players = [player1, player2]
		this.board = Array(9).fill(null)
		this.currentPlayer = 0
		this.gameStatus = 'playing'
		this.winner = null

		this.players[0].symbol = 'X'
		this.players[1].symbol = 'O'
		this.players[0].gameId = this.id
		this.players[1].gameId = this.id
	}

	makeMove(playerIndex, position) {
		if (
			this.gameStatus !== 'playing' ||
			this.currentPlayer !== playerIndex ||
			this.board[position] !== null
		) {
			return false
		}

		this.board[position] = this.players[playerIndex].symbol

		if (this.checkWinner()) {
			this.gameStatus = 'finished'
			this.winner = playerIndex
		} else if (this.board.every(cell => cell !== null)) {
			this.gameStatus = 'finished'
			this.winner = 'draw'
		} else {
			this.currentPlayer = 1 - this.currentPlayer
		}

		return true
	}

	checkWinner() {
		const winPatterns = [
			[0, 1, 2],
			[3, 4, 5],
			[6, 7, 8],
			[0, 3, 6],
			[1, 4, 7],
			[2, 5, 8],
			[0, 4, 8],
			[2, 4, 6],
		]

		return winPatterns.some(pattern => {
			const [a, b, c] = pattern
			return (
				this.board[a] &&
				this.board[a] === this.board[b] &&
				this.board[a] === this.board[c]
			)
		})
	}

	getGameState() {
		return {
			board: this.board,
			currentPlayer: this.currentPlayer,
			gameStatus: this.gameStatus,
			winner: this.winner,
			players: this.players.map(p => ({
				name: p.name,
				symbol: p.symbol,
			})),
		}
	}
}

io.on('connection', socket => {
	console.log('Yangi foydalanuvchi ulandi:', socket.id)

	socket.on('searchPlayer', playerName => {
		const player = {
			id: socket.id,
			name: playerName,
			socket: socket,
		}

		if (waitingPlayers.length > 0) {
			const opponent = waitingPlayers.shift()

			const game = new Game(opponent, player)
			games.set(game.id, game)
			;[opponent, player].forEach((p, index) => {
				p.socket.join(game.id)
				p.socket.emit('gameFound', {
					gameId: game.id,
					playerIndex: index,
					opponent: index === 0 ? player.name : opponent.name,
					symbol: p.symbol,
					gameState: game.getGameState(),
				})
			})

			console.log(
				`O'yin yaratildi: ${game.id}, O'yinchilar: ${opponent.name} vs ${player.name}`
			)
		} else {
			waitingPlayers.push(player)
			socket.emit('waiting')
			console.log(`${playerName} o'yinchi kutmoqda...`)
		}
	})

	socket.on('makeMove', data => {
		const { gameId, position } = data
		const game = games.get(gameId)

		if (!game) {
			socket.emit('error', "O'yin topilmadi")
			return
		}

		const playerIndex = game.players.findIndex(p => p.id === socket.id)
		if (playerIndex === -1) {
			socket.emit('error', "Siz bu o'yinda emassiz")
			return
		}

		if (game.makeMove(playerIndex, position)) {
			io.to(gameId).emit('gameUpdate', game.getGameState())

			if (game.gameStatus === 'finished') {
				console.log(`O'yin tugadi: ${gameId}, G'olib: ${game.winner}`)
			}
		} else {
			socket.emit('invalidMove', "Noto'g'ri harakat")
		}
	})

	socket.on('restartGame', gameId => {
		const game = games.get(gameId)
		if (!game) return

		const playerIndex = game.players.findIndex(p => p.id === socket.id)
		if (playerIndex === -1) return

		game.board = Array(9).fill(null)
		game.currentPlayer = 0
		game.gameStatus = 'playing'
		game.winner = null

		io.to(gameId).emit('gameUpdate', game.getGameState())
		console.log(`O'yin qayta boshlandi: ${gameId}`)
	})

	socket.on('disconnect', () => {
		console.log('Foydalanuvchi uzildi:', socket.id)

		const waitingIndex = waitingPlayers.findIndex(p => p.id === socket.id)
		if (waitingIndex !== -1) {
			waitingPlayers.splice(waitingIndex, 1)
		}

		for (const [gameId, game] of games) {
			const playerIndex = game.players.findIndex(p => p.id === socket.id)
			if (playerIndex !== -1) {
				const opponentIndex = 1 - playerIndex
				const opponent = game.players[opponentIndex]
				if (opponent && opponent.socket) {
					opponent.socket.emit('opponentDisconnected')
				}

				games.delete(gameId)
				console.log(`O'yin o'chirildi (uzilish): ${gameId}`)
				break
			}
		}
	})
})

const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
	console.log(`Server ishga tushdi: http://localhost:${PORT}`)
})
