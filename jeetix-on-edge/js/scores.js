const STORAGE_NAME = 'score'

function makeScoreManager() {
    let score = 0
    let highScore = _fromStorageOrFail()

    function get() {
        return score
    }

    function set(value) {
        score = value
    }

    function add(value) {
        score += value
    }

    // Saves score to localstorage if it's a new highscore, returns a bool based on if it's a new highscore or not
    function flush() {
        if (score <= highScore) {
            return false
        }

        try {
            localStorage.setItem(STORAGE_NAME, `${score}`)
        } catch { /* Possibly out of storage */ }

        highScore = score

        return true
    }

    function getHighScore() {
        return highScore
    }

    function _fromStorageOrFail() {
        const local = Number(localStorage.getItem(STORAGE_NAME))

        if (isNaN(local)) {
            return 0
        }

        return local
    }

    return {
        get,
        set,
        add,
        flush,
        getHighScore,
    }
}

const ScoreManager = makeScoreManager()

export default ScoreManager
