const STORAGE_NAME = 'score'

export default function ScoreManager() {
    let currentScore = 0
    let highScore = _fromStorageOrDefault()

    function getHighScore() {
        return highScore
    }

    function get() {
        return currentScore
    }

    function set(value) {
        currentScore = value
    }

    function add(value) {
        currentScore += value
    }

    // saves the score to local storage if it's a new high score
    // also returns a bool based on if it was a high score or not
    function flushToStorage() {
        if (currentScore <= highScore) {
            return false
        }

        try {
            localStorage.setItem(STORAGE_NAME, `${currentScore}`)
        } catch { /* Possibly out of storage */ }

        highScore = currentScore

        return true
    }

    function _fromStorageOrDefault() {
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
        flushToStorage,
        getHighScore,
    }
}
