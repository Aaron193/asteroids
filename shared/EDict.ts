/**
 * EDict
 * A id -> entity dictionary utilizing a map and array for O(1) lookup and javascript's fast array iteration
 */

interface BaseEntity {
    [key: string]: any;
}
export class EDict<T extends BaseEntity> {
    private arr: T[] = [];
    private indexMap: Map<number, number> = new Map();

    private idPropName: keyof T;

    constructor(idPropName: keyof T) {
        this.idPropName = idPropName;
    }

    /**
     * Add entity to the dictionary
     */
    add(value: T) {
        const id = value[this.idPropName];
        this.arr.push(value);
        this.indexMap.set(id, this.arr.length - 1);
    }

    /**
     * Remove entity from the dictionary
     */
    remove(id: number) {
        const index = this.indexMap.get(id);
        if (index === undefined) {
            return;
        }

        const lastIndex = this.arr.length - 1;
        if (index !== lastIndex) {
            const temp = this.arr[index];
            this.arr[index] = this.arr[lastIndex];
            this.arr[lastIndex] = temp;
            this.indexMap.set(this.arr[index][this.idPropName], index);
        }

        this.arr.pop();
        this.indexMap.delete(id);
    }

    /**
     * Check if the dictionary has the entity
     */
    has(id: number) {
        return this.indexMap.has(id);
    }

    /**
     * Get entity from the dictionary
     */
    get(id: number) {
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
     * Get all items in the dictionary
     */
    array() {
        return this.arr;
    }
}
