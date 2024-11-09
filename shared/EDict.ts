/**
 * EDict
 * A id -> entity dictionary utilizing a map and array for O(1) lookup and javascript's fast array iteration
 */
export class EDict<ID_TYPE, T> {
    private arr: T[] = [];
    private indexMap: Map<ID_TYPE, number> = new Map();

    /**
     * Add entity to the dictionary
     */
    add(id: ID_TYPE, value: T) {
        this.arr.push(value);
        this.indexMap.set(id, this.arr.length - 1);
    }

    /**
     * Remove entity from the dictionary
     */
    remove(id: ID_TYPE) {
        const index = this.indexMap.get(id);
        if (index === undefined) {
            return;
        }

        const lastIndex = this.arr.length - 1;
        const temp = this.arr[index];
        this.arr[index] = this.arr[lastIndex];
        this.arr[lastIndex] = temp;

        this.arr.pop();
        this.indexMap.delete(id);
    }

    /**
     * Check if the dictionary has the entity
     */
    has(id: ID_TYPE) {
        return this.indexMap.has(id);
    }

    /**
     * Get entity from the dictionary
     */
    get(id: ID_TYPE) {
        const index = this.indexMap.get(id);
        if (index === undefined) {
            return undefined;
        }

        return this.arr[index];
    }

    /**
     * Clear the dictionary
     */
    clear() {
        this.arr = [];
        this.indexMap.clear();
    }

    /**
     * Get all entries in the dictionary
     */
    entries() {
        return this.arr;
    }
}
