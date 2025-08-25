const { Plugin, ItemView, PluginSettingTab, Setting, Notice } = require('obsidian');

const DEFAULT_SETTINGS = {
    showDepth: 2,
    horizontalSpacing: 150,
    verticalSpacing: 100,
    maxBranches: 5
};

class ZettelkastenBranchTracker extends Plugin {
    async onload() {
        await this.loadSettings();

        this.registerView(
            'zettelkasten-branch-view',
            (leaf) => new ZettelkastenBranchView(leaf, this)
        );

        this.addRibbonIcon('signpost-big', 'Zettelkasten branch tracker', () => {
            this.activateView();
        });

        this.addCommand({
            id: 'open-zettelkasten-branch-view',
            name: 'Open Zettelkasten branch view',
            callback: () => {
                this.activateView();
            }
        });

        // Navigation hotkeys
        this.addCommand({
            id: 'navigate-to-next-sibling',
            name: 'Navigate to next sibling',
            callback: () => {
                this.navigateToSibling('next');
            }
        });

        this.addCommand({
            id: 'navigate-to-previous-sibling',
            name: 'Navigate to previous sibling',
            callback: () => {
                this.navigateToSibling('previous');
            }
        });

        this.addCommand({
            id: 'navigate-to-parent',
            name: 'Navigate to parent note',
            callback: () => {
                this.navigateToParent();
            }
        });

        this.addCommand({
            id: 'navigate-to-first-child',
            name: 'Navigate to first child',
            callback: () => {
                this.navigateToFirstChild();
            }
        });

        this.addCommand({
            id: 'navigate-to-next-continuation',
            name: 'Navigate to next linear continuation',
            callback: () => {
                this.navigateToContinuation('next');
            }
        });

        this.addCommand({
            id: 'navigate-to-previous-continuation',
            name: 'Navigate to previous linear continuation',
            callback: () => {
                this.navigateToContinuation('previous');
            }
        });

        this.addSettingTab(new ZettelkastenSettingTab(this.app, this));
    }

    async activateView() {
        const { workspace } = this.app;

        let leaf = null;
        const leaves = workspace.getLeavesOfType('zettelkasten-branch-view');

        if (leaves.length > 0) {
            leaf = leaves[0];
        } else {
            leaf = workspace.getRightLeaf(false);
            await leaf.setViewState({ type: 'zettelkasten-branch-view', active: true });
        }

        workspace.revealLeaf(leaf);
    }
    async navigateToSibling(direction) {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice('No active file');
            return;
        }

        const currentZettelId = this.parseZettelId(activeFile.basename);
        if (!currentZettelId) {
            new Notice('Current file is not a Zettelkasten note');
            return;
        }

        const zettelNotes = this.getZettelNotes();
        const parentId = this.findParentId(currentZettelId);

        if (!parentId) {
            new Notice('Current note has no parent (cannot find siblings)');
            return;
        }

        // Get all siblings including current note
        const allSiblings = this.findChildIds(parentId, zettelNotes);
        const sortedSiblings = allSiblings.sort(this.compareZettelIds.bind(this));

        const currentIndex = sortedSiblings.indexOf(currentZettelId);
        if (currentIndex === -1) {
            new Notice('Could not find current note among siblings');
            return;
        }

        let targetIndex;
        if (direction === 'next') {
            targetIndex = currentIndex + 1;
            if (targetIndex >= sortedSiblings.length) {
                new Notice('Already at last sibling');
                return;
            }
        } else {
            targetIndex = currentIndex - 1;
            if (targetIndex < 0) {
                new Notice('Already at first sibling');
                return;
            }
        }

        const targetZettelId = sortedSiblings[targetIndex];
        const targetFile = zettelNotes.get(targetZettelId);

        if (targetFile) {
            await this.app.workspace.getLeaf(false).openFile(targetFile);
        } else {
            new Notice(`Target sibling note not found: ${targetZettelId}`);
        }
    }

    async navigateToParent() {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice('No active file');
            return;
        }

        const currentZettelId = this.parseZettelId(activeFile.basename);
        if (!currentZettelId) {
            new Notice('Current file is not a Zettelkasten note');
            return;
        }

        const parentId = this.findParentId(currentZettelId);
        if (!parentId) {
            new Notice('Current note has no parent');
            return;
        }

        const zettelNotes = this.getZettelNotes();
        const parentFile = zettelNotes.get(parentId);

        if (parentFile) {
            await this.app.workspace.getLeaf(false).openFile(parentFile);
        } else {
            new Notice(`Parent note not found: ${parentId}`);
        }
    }

    async navigateToFirstChild() {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice('No active file');
            return;
        }

        const currentZettelId = this.parseZettelId(activeFile.basename);
        if (!currentZettelId) {
            new Notice('Current file is not a Zettelkasten note');
            return;
        }

        const zettelNotes = this.getZettelNotes();
        const children = this.findChildIds(currentZettelId, zettelNotes);

        if (children.length === 0) {
            new Notice('Current note has no children');
            return;
        }
    }
        
    async navigateToContinuation(direction) {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) {
        new Notice('No active file');
        return;
    }

    const currentZettelId = this.parseZettelId(activeFile.basename);
    if (!currentZettelId) {
        new Notice('Current file is not a Zettelkasten note');
        return;
    }

    const zettelNotes = this.getZettelNotes();
    
    if (direction === 'next') {
        // Find continuations of current note
        const continuations = this.findLinearContinuations(currentZettelId, zettelNotes);
        if (continuations.length === 0) {
            new Notice('No linear continuations found');
            return;
        }
        
        const firstContinuation = continuations[0];
        const targetFile = zettelNotes.get(firstContinuation);
        
        if (targetFile) {
            await this.app.workspace.getLeaf(false).openFile(targetFile);
        }
    } else {
        // Find what this note is a continuation of
        const allNotes = Array.from(zettelNotes.keys());
        const possibleBase = allNotes.find(noteId => {
            const continuations = this.findLinearContinuations(noteId, zettelNotes);
            return continuations.includes(currentZettelId);
        });
        
        if (possibleBase) {
            const baseFile = zettelNotes.get(possibleBase);
            if (baseFile) {
                await this.app.workspace.getLeaf(false).openFile(baseFile);
            }
        } else {
            new Notice('This note is not a linear continuation');
        }
    }

        const sortedChildren = children.sort(this.compareZettelIds.bind(this));
        const firstChildId = sortedChildren[0];
        const firstChildFile = zettelNotes.get(firstChildId);

        if (firstChildFile) {
            await this.app.workspace.getLeaf(false).openFile(firstChildFile);
        } else {
            new Notice(`First child note not found: ${firstChildId}`);
        }
    }
    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    parseZettelId(filename) {
        const match = filename.match(/^([0-9]+(?:[a-z]+[0-9]*|\.[0-9]+)*(?:[a-z]+[0-9]*)*)(?:\s|$)/i);
        return match ? match[1] : null;
    }

    findParentId(zettelId) {
        // Handle different patterns in order of specificity

        // Pattern 1: Remove trailing number after letter (like 5301.1.2.1.1.2b1 -> 5301.1.2.1.1.2b)
        if (zettelId.match(/[a-z]\d+$/)) {
            return zettelId.replace(/\d+$/, '');
        }

        // Pattern 2: Remove trailing letter(s) (like 5301.1.2.1.1.2a -> 5301.1.2.1.1.2)
        if (zettelId.match(/[a-z]+$/)) {
            return zettelId.replace(/[a-z]+$/, '');
        }

        // Pattern 3: Remove last dot+number (like 5301.1.2.1.1.2 -> 5301.1.2.1.1)
        if (zettelId.match(/\.\d+$/)) {
            return zettelId.replace(/\.\d+$/, '');
        }

        return null;
    }

    getZettelNotes() {
        const zettelNotes = new Map();

        this.app.vault.getMarkdownFiles().forEach(file => {
            const zettelId = this.parseZettelId(file.basename);
            if (zettelId) {
                zettelNotes.set(zettelId, file);
            }
        });

        return zettelNotes;
    }

    buildZettelNetwork(currentZettelId, maxDepth = 2, maxBranches = 5) {
        const zettelNotes = this.getZettelNotes();
        const currentFile = zettelNotes.get(currentZettelId);

        if (!currentFile) return null;

        const nodes = new Map();
        const edges = [];

        if (maxDepth >= 1) {
            this.addParentTier(currentZettelId, zettelNotes, nodes, edges, maxBranches);
        }

        if (maxDepth >= 2) {
            this.addGrandparentTier(currentZettelId, zettelNotes, nodes, edges, maxBranches);
        }

        if (maxDepth >= 3) {
            this.addGreatGrandparentTier(currentZettelId, zettelNotes, nodes, edges, maxBranches);
        }

        this.addCurrentNoteTier(currentZettelId, zettelNotes, nodes, edges, maxBranches);
        this.addChildrenTier(currentZettelId, zettelNotes, nodes, edges, maxBranches);

        // Add depth data to nodes
        this.addDepthDataToNodes({ nodes, edges }, zettelNotes, currentZettelId);

        return { nodes, edges };
    }

    calculateNodeDepth(nodeId, zettelNotes) {
        let totalSubnotes = 0;

        // Count all notes that are descendants of this node
        for (const zettelId of zettelNotes.keys()) {
            if (zettelId.startsWith(nodeId) && zettelId !== nodeId) {
                totalSubnotes++;
            }
        }

        return totalSubnotes;
    }

    addDepthDataToNodes(network, zettelNotes, currentZettelId) {
        const depthValues = [];

        // Build current note lineage to exclude from scaling
        const currentLineage = new Set();
        currentLineage.add(currentZettelId); // Current note

        // Add parents/grandparents to lineage
        let parentId = this.findParentId(currentZettelId);
        while (parentId) {
            currentLineage.add(parentId);
            parentId = this.findParentId(parentId);
        }

        // Calculate depth for children (level 1), siblings (level -1), aunts/uncles (level -2), and sequential continuations (level 0)
        // BUT exclude nodes in the current lineage
        for (const [nodeId, node] of network.nodes.entries()) {
            if ([1, -1, -2, 0].includes(node.level) && !currentLineage.has(nodeId)) {
                const depth = this.calculateNodeDepth(nodeId, zettelNotes);
                node.subnotesCount = depth;
                depthValues.push(depth);
            }
        }

        if (depthValues.length === 0) return; // No nodes to process

        // Calculate percentiles for scaling (among all depth-tracked nodes)
        depthValues.sort((a, b) => a - b);
        const maxDepth = Math.max(...depthValues);
        const minDepth = Math.min(...depthValues);

        // Add normalized depth score (0 to 1) to tracked nodes (excluding lineage)
        for (const [nodeId, node] of network.nodes.entries()) {
            if ([1, -1, -2, 0].includes(node.level) && !currentLineage.has(nodeId)) {
                if (maxDepth === minDepth) {
                    node.depthScore = 0.5; // All nodes have same depth
                } else {
                    node.depthScore = (node.subnotesCount - minDepth) / (maxDepth - minDepth);
                }
            }
        }
    }

    addGreatGrandparentTier(currentZettelId, zettelNotes, nodes, edges, maxBranches) {
        const grandparentId = this.findGrandparentId(currentZettelId);
        if (!grandparentId) return;

        const greatGrandparentId = this.findParentId(grandparentId);
        if (!greatGrandparentId || !zettelNotes.has(greatGrandparentId)) return;

        const greatGrandparentFile = zettelNotes.get(greatGrandparentId);
        const greatGrandparentNode = {
            id: greatGrandparentId,
            title: greatGrandparentFile.basename,
            level: -4,
            isCenter: false,
            position: { x: 0, y: -240 }
        };
        nodes.set(greatGrandparentId, greatGrandparentNode);

        const greatAuntsUncles = this.findChildIds(greatGrandparentId, zettelNotes)
            .filter(id => id !== grandparentId);
        const closestGreatAuntsUncles = this.getClosestSiblings(grandparentId, greatAuntsUncles, maxBranches);

        if (closestGreatAuntsUncles.length > 0) {
            closestGreatAuntsUncles.forEach((auntUncleId, index) => {
                const auntUncleFile = zettelNotes.get(auntUncleId);

                let auntUncleX;
                if (closestGreatAuntsUncles.length === 1) {
                    auntUncleX = 0;
                } else {
                    const spacing = 120;
                    const totalWidth = (closestGreatAuntsUncles.length - 1) * spacing;
                    const startX = -totalWidth / 2;
                    auntUncleX = startX + (index * spacing);
                }

                const auntUncleNode = {
                    id: auntUncleId,
                    title: auntUncleFile.basename,
                    level: -3,
                    isCenter: false,
                    position: { x: auntUncleX, y: -160 }
                };
                nodes.set(auntUncleId, auntUncleNode);
                edges.push({ from: greatGrandparentId, to: auntUncleId, type: 'parent-child' });
            });
        }

        edges.push({ from: greatGrandparentId, to: grandparentId, type: 'parent-child' });
    }

    addGrandparentTier(currentZettelId, zettelNotes, nodes, edges, maxBranches) {
        const grandparentId = this.findGrandparentId(currentZettelId);
        if (!grandparentId || !zettelNotes.has(grandparentId)) return;

        const grandparentFile = zettelNotes.get(grandparentId);
        const grandparentNode = {
            id: grandparentId,
            title: grandparentFile.basename,
            level: -3,
            isCenter: false,
            position: { x: 0, y: -160 }
        };
        nodes.set(grandparentId, grandparentNode);

        const parentId = this.findParentId(currentZettelId);
        const auntsUncles = this.findChildIds(grandparentId, zettelNotes)
            .filter(id => id !== parentId);

        // Filter out linear continuations of the grandparent
        const trueAuntsUncles = auntsUncles.filter(auntUncleId => {
            const remainder = auntUncleId.substring(grandparentId.length);

            // If remainder is just letters (like 'a', 'b'), it's a grandparent continuation, not an aunt/uncle
            if (remainder.match(/^[a-z]+$/)) {
                return false; // Exclude these
            }

            // If remainder is just numbers (like '1', '2'), it's a grandparent continuation, not an aunt/uncle  
            if (remainder.match(/^\d+$/)) {
                return false; // Exclude these
            }

            // Keep everything else (like .1, .2, .3 which are true children)
            return true;
        });

        const closestAuntsUncles = this.getClosestSiblings(parentId || currentZettelId, trueAuntsUncles, maxBranches);

        if (closestAuntsUncles.length > 0) {
            closestAuntsUncles.forEach((auntUncleId, index) => {
                const auntUncleFile = zettelNotes.get(auntUncleId);

                // Always spread aunts/uncles around center, never AT center
                const spacing = 150;
                const totalPositions = closestAuntsUncles.length;

                // Calculate position that skips 0 (center)
                let position;
                const halfCount = Math.floor(totalPositions / 2);

                if (index < halfCount) {
                    // Left side: -halfCount, -halfCount+1, ..., -1
                    position = -(halfCount - index);
                } else {
                    // Right side: +1, +2, ..., +remaining
                    position = index - halfCount + 1;
                }

                const auntUncleX = position * spacing;

                const auntUncleNode = {
                    id: auntUncleId,
                    title: auntUncleFile.basename,
                    level: -2,
                    isCenter: false,
                    position: { x: auntUncleX, y: -80 }
                };
                nodes.set(auntUncleId, auntUncleNode);
                edges.push({ from: grandparentId, to: auntUncleId, type: 'parent-child' });
            });
        }

        if (parentId) {
            edges.push({ from: grandparentId, to: parentId, type: 'parent-child' });
        }
    }

    addParentTier(currentZettelId, zettelNotes, nodes, edges, maxBranches) {
        const parentId = this.findParentId(currentZettelId);

        if (!parentId) {
            const syntheticParent = this.findPreviousNoteInSequence(currentZettelId, zettelNotes);
            if (syntheticParent) {
                const parentFile = zettelNotes.get(syntheticParent);
                const parentNode = {
                    id: syntheticParent,
                    title: parentFile.basename,
                    level: -2,
                    isCenter: false,
                    position: { x: 0, y: -80 }
                };
                nodes.set(syntheticParent, parentNode);
                edges.push({ from: syntheticParent, to: currentZettelId, type: 'sequence-link' });
            }
            return;
        }

        if (!zettelNotes.has(parentId)) return;

        const parentFile = zettelNotes.get(parentId);
        const parentNode = {
            id: parentId,
            title: parentFile.basename,
            level: -2,
            isCenter: false,
            position: { x: 0, y: -80 }
        };
        nodes.set(parentId, parentNode);

        const allSiblings = this.findChildIds(parentId, zettelNotes)
            .filter(id => id !== currentZettelId);

        const closestSiblings = this.getClosestSiblings(currentZettelId, allSiblings, maxBranches);

        if (closestSiblings.length > 0) {
            closestSiblings.forEach((siblingId, index) => {
                const siblingFile = zettelNotes.get(siblingId);

                let siblingX;
                if (closestSiblings.length === 1) {
                    siblingX = 0;
                } else {
                    const spacing = 120;
                    const totalWidth = (closestSiblings.length - 1) * spacing;
                    const startX = -totalWidth / 2;
                    siblingX = startX + (index * spacing);
                }

                const siblingNode = {
                    id: siblingId,
                    title: siblingFile.basename,
                    level: -1,
                    isCenter: false,
                    position: { x: siblingX, y: -40 }
                };
                nodes.set(siblingId, siblingNode);
                edges.push({ from: parentId, to: siblingId, type: 'parent-child' });
            });
        }

        edges.push({ from: parentId, to: currentZettelId, type: 'parent-child' });
    }

    addCurrentNoteTier(currentZettelId, zettelNotes, nodes, edges, maxBranches) {
        const currentFile = zettelNotes.get(currentZettelId);
        const currentNode = {
            id: currentZettelId,
            title: currentFile.basename,
            level: 0,
            isCenter: true,
            position: { x: 0, y: 0 }
        };
        nodes.set(currentZettelId, currentNode);

        const linearContinuations = this.findLinearContinuations(currentZettelId, zettelNotes);

        linearContinuations.slice(0, Math.max(0, maxBranches - 1)).forEach((continuationId, index) => {
            const continuationFile = zettelNotes.get(continuationId);
            const continuationX = (index + 1) * 140;

            const continuationNode = {
                id: continuationId,
                title: continuationFile.basename,
                level: 0,
                isCenter: false,
                position: { x: continuationX, y: 0 }
            };
            nodes.set(continuationId, continuationNode);
            edges.push({ from: currentZettelId, to: continuationId, type: 'linear-continuation' });
        });
    }

    addChildrenTier(currentZettelId, zettelNotes, nodes, edges, maxBranches) {
        // Find all potential children (anything that starts with current ID)
        const allChildren = this.findChildIds(currentZettelId, zettelNotes);

        // Filter out linear continuations, keep only true dot-notation children
        const trueChildren = allChildren.filter(childId => {
            const remainder = childId.substring(currentZettelId.length);

            // If remainder is just letters (like 'a', 'b'), it's a linear continuation, not a true child
            if (remainder.match(/^[a-z]+$/)) {
                return false; // Exclude these
            }

            // If remainder is just numbers (like '1', '2'), it's a linear continuation, not a true child  
            if (remainder.match(/^\d+$/)) {
                return false; // Exclude these
            }

            // If remainder has letter+numbers (like 'a1', 'b2'), it's a linear continuation
            if (remainder.match(/^[a-z]+\d+$/)) {
                return false; // Exclude these
            }

            // Keep only dot-notation children (like '.1', '.2', '.3')
            if (remainder.match(/^\.\d+/)) {
                return true; // Keep these
            }

            // Exclude anything else that doesn't match our expected patterns
            return false;
        });

        const childrenToShow = trueChildren.slice(0, maxBranches);

        if (childrenToShow.length === 0) {
            return;
        }

        // Position children using simple centered spread
        childrenToShow.forEach((childId, index) => {
            const childFile = zettelNotes.get(childId);

            let childX;
            if (childrenToShow.length === 1) {
                childX = 0;
            } else {
                const spacing = 120;
                const totalWidth = (childrenToShow.length - 1) * spacing;
                const startX = -totalWidth / 2;
                childX = startX + (index * spacing);
            }

            const childNode = {
                id: childId,
                title: childFile.basename,
                level: 1,
                isCenter: false,
                position: { x: childX, y: 80 }
            };
            nodes.set(childId, childNode);
            edges.push({ from: currentZettelId, to: childId, type: 'parent-child' });
        });
    }

    findGrandparentId(zettelId) {
        const parentId = this.findParentId(zettelId);
        if (!parentId) return null;
        return this.findParentId(parentId);
    }

    findPreviousNoteInSequence(zettelId, zettelNotes) {
        if (!/^\d+$/.test(zettelId)) return null;

        const baseNumber = parseInt(zettelId);

        const candidates = [
            Math.floor(baseNumber / 100) * 100,
            Math.floor(baseNumber / 1000) * 1000
        ];

        for (const candidate of candidates) {
            if (candidate > 0 && candidate !== baseNumber && zettelNotes.has(String(candidate))) {
                return String(candidate);
            }
        }

        return null;
    }

    isLinearContinuation(baseId, otherId) {
        if (otherId.startsWith(baseId)) {
            const remainder = otherId.substring(baseId.length);
            return remainder.match(/^\d+$/) || remainder.match(/^[a-z]$/);
        }
        if (baseId.startsWith(otherId)) {
            const remainder = baseId.substring(otherId.length);
            return remainder.match(/^\d+$/) || remainder.match(/^[a-z]$/);
        }
        return false;
    }

    getClosestSiblings(currentId, allSiblings, maxBranches) {
        if (allSiblings.length === 0) return [];

        const allSiblingsWithCurrent = [...allSiblings, currentId].sort(this.compareZettelIds.bind(this));
        const currentIndex = allSiblingsWithCurrent.indexOf(currentId);

        const result = [];
        const remaining = maxBranches;

        let leftIndex = currentIndex - 1;
        let rightIndex = currentIndex + 1;

        for (let i = 0; i < remaining && result.length < allSiblings.length; i++) {
            const hasLeft = leftIndex >= 0 && allSiblingsWithCurrent[leftIndex] !== currentId;
            const hasRight = rightIndex < allSiblingsWithCurrent.length && allSiblingsWithCurrent[rightIndex] !== currentId;

            if (!hasLeft && !hasRight) break;

            if (hasLeft && (!hasRight || i % 2 === 0)) {
                result.unshift(allSiblingsWithCurrent[leftIndex]);
                leftIndex--;
            } else if (hasRight) {
                result.push(allSiblingsWithCurrent[rightIndex]);
                rightIndex++;
            }
        }

        return result.slice(0, maxBranches);
    }

    findLinearContinuations(baseId, zettelNotes) {
        const continuations = [];

        for (const zettelId of zettelNotes.keys()) {
            if (zettelId.startsWith(baseId) && zettelId !== baseId) {
                const remainder = zettelId.substring(baseId.length);
                if (remainder.match(/^\d+$/) || remainder.match(/^[a-z]$/)) {
                    continuations.push(zettelId);
                }
            }
        }

        return continuations.sort(this.compareZettelIds.bind(this));
    }

    findTrueChildren(baseId, zettelNotes) {
        const children = [];

        for (const zettelId of zettelNotes.keys()) {
            if (zettelId.startsWith(baseId) && zettelId !== baseId) {
                const remainder = zettelId.substring(baseId.length);
                if (remainder.match(/^\.\d+/)) {
                    children.push(zettelId);
                }
            }
        }

        return children.sort(this.compareZettelIds.bind(this));
    }

    findChildIds(parentId, zettelNotes) {
        const childIds = [];

        for (const zettelId of zettelNotes.keys()) {
            const noteParent = this.findParentId(zettelId);

            if (noteParent === parentId) {
                childIds.push(zettelId);
            }
        }

        return childIds.sort(this.compareZettelIds.bind(this));
    }

    compareZettelIds(a, b) {
        const partsA = a.split(/([a-z]+)/).filter(p => p);
        const partsB = b.split(/([a-z]+)/).filter(p => p);

        for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
            const partA = partsA[i] || '';
            const partB = partsB[i] || '';

            if (partA !== partB) {
                if (!isNaN(Number(partA)) && !isNaN(Number(partB))) {
                    return Number(partA) - Number(partB);
                }
                return partA.localeCompare(partB);
            }
        }

        return 0;
    }
}

class ZettelkastenBranchView extends ItemView {
    constructor(leaf, plugin) {
        super(leaf);
        this.plugin = plugin;
        this.currentDepth = this.plugin.settings.showDepth;
        this.currentMaxBranches = this.plugin.settings.maxBranches;
        this.zoom = 1.0;
        this.hoveredNode = null;
        this.panOffset = { x: 0, y: 0 };

        this.mousePos = { x: 0, y: 0 };
        this.isDragging = false;
        this.dragStartPos = { x: 0, y: 0 };
        this.lastPanOffset = { x: 0, y: 0 };

        this.showSubnoteCounts = true;
        this.autoUpdate = true;

        this.nodeScales = new Map();
        this.targetScales = new Map();
        this.textOffsets = new Map();
        this.targetTextOffsets = new Map();
        this.animationSpeed = 0.15;

        this.animationId = null;
        this.needsRender = true;
        this.debugOnce = true; // For debugging colors
        this.animationStartTime = Date.now(); // For pulsing animations
    }

    getViewType() {
        return 'zettelkasten-branch-view';
    }

    getDisplayText() {
        return 'Zettelkasten branch tracker';
    }

    getIcon() {
        return 'signpost-big';
    }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();

        const controlsSection = container.createEl('div', {
            cls: 'zettelkasten-controls-section'
        });
        // Styles handled by CSS

        const controlsHeader = controlsSection.createEl('div', {
            cls: 'zettelkasten-controls-header'
        });
        // Styles handled by CSS

        const toggleIcon = controlsHeader.createEl('span', { 
            text: '▼',
            cls: 'zettelkasten-toggle-icon'
        });

        controlsHeader.createEl('span', { text: 'Controls' });

        const controlsContainer = controlsSection.createEl('div', {
            cls: 'zettelkasten-controls-container'
        });

        let controlsExpanded = true;
        controlsHeader.addEventListener('click', () => {
            controlsExpanded = !controlsExpanded;
            if (controlsExpanded) {
                controlsContainer.style.display = 'block';
                toggleIcon.textContent = '▼';
                toggleIcon.style.transform = 'rotate(0deg)';
            } else {
                controlsContainer.style.display = 'none';
                toggleIcon.textContent = '▶';
                toggleIcon.style.transform = 'rotate(-90deg)';
            }

            setTimeout(() => {
                this.updateCanvasContainerSize();
                this.resizeCanvas();
                this.needsRender = true;
            }, 10);
        });

        // SLIDERS SECTION
        const slidersSection = controlsContainer.createEl('div', {
            cls: 'zettelkasten-sliders-section'
        });

        const depthControl = slidersSection.createEl('div', {
            cls: 'zettelkasten-control-row'
        });

        depthControl.createEl('label', {
            text: 'Depth: ',
            cls: 'zettelkasten-control-label'
        });

        this.depthSlider = depthControl.createEl('input', {
            type: 'range'
        });
        this.depthSlider.min = '1';
        this.depthSlider.max = '3';
        this.depthSlider.value = String(this.currentDepth);
        this.depthSlider.className = 'zettelkasten-slider';

        this.depthLabel = depthControl.createEl('span', {
            text: String(this.currentDepth)
        });
        this.depthLabel.className = 'zettelkasten-value-label';

        const branchControl = slidersSection.createEl('div', {
            cls: 'zettelkasten-control-row'
        });

        branchControl.createEl('label', {
            text: 'Branches: ',
            cls: 'zettelkasten-control-label'
        });

        this.branchSlider = branchControl.createEl('input', {
            type: 'range'
        });
        this.branchSlider.min = '1';
        this.branchSlider.max = '10';
        this.branchSlider.value = String(this.currentMaxBranches);
        this.branchSlider.className = 'zettelkasten-slider';

        this.branchLabel = branchControl.createEl('span', {
            text: String(this.currentMaxBranches)
        });
        this.branchLabel.className = 'zettelkasten-value-label';

        const forceControl = slidersSection.createEl('div', {
            cls: 'zettelkasten-control-row'
        });

        forceControl.createEl('label', {
            text: 'Spacing: ',
            cls: 'zettelkasten-control-label'
        });

        this.forceSlider = forceControl.createEl('input', {
            type: 'range'
        });
        this.forceSlider.min = '50';
        this.forceSlider.max = '200';
        this.forceSlider.value = '100';
        this.forceSlider.className = 'zettelkasten-slider';

        this.forceLabel = forceControl.createEl('span', {
            text: '100%'
        });
        this.forceLabel.className = 'zettelkasten-force-value-label';

        // DIVIDER
        const divider = controlsContainer.createEl('div', {
            cls: 'zettelkasten-divider'
        });

        // CHECKBOXES SECTION - RESPONSIVE SIDE-BY-SIDE
        const checkboxSection = controlsContainer.createEl('div', {
            cls: 'zettelkasten-checkbox-section'
        });

        // Subnote counts checkbox
        const countControl = checkboxSection.createEl('div', {
            cls: 'zettelkasten-checkbox-control'
        });

        this.countCheckbox = countControl.createEl('input', {
            type: 'checkbox'
        });
        this.countCheckbox.checked = this.showSubnoteCounts;
        this.countCheckbox.className = 'zettelkasten-checkbox';

        const countLabel = countControl.createEl('label', {
            text: 'Show counts'
        });
        countLabel.className = 'zettelkasten-checkbox-label';

        // Auto-update checkbox
        const autoUpdateControl = checkboxSection.createEl('div', {
            cls: 'zettelkasten-checkbox-control auto-update'
        });

        this.autoUpdateCheckbox = autoUpdateControl.createEl('input', {
            type: 'checkbox'
        });
        this.autoUpdateCheckbox.checked = this.autoUpdate;
        this.autoUpdateCheckbox.className = 'zettelkasten-checkbox';

        const autoUpdateLabel = autoUpdateControl.createEl('label', {
            text: 'Auto-update'
        });
        autoUpdateLabel.className = 'zettelkasten-checkbox-label';

        // Event listeners for sliders
        this.depthSlider.addEventListener('input', (e) => {
            this.currentDepth = parseInt(e.target.value);
            this.depthLabel.textContent = String(this.currentDepth);
            this.updateView();
        });

        this.branchSlider.addEventListener('input', (e) => {
            this.currentMaxBranches = parseInt(e.target.value);
            this.branchLabel.textContent = String(this.currentMaxBranches);
            this.updateView();
        });

        this.forceSlider.addEventListener('input', (e) => {
            const forceValue = parseInt(e.target.value);
            this.forceLabel.textContent = forceValue + '%';
            this.needsRender = true;
        });

        // Event listeners for checkboxes
        countLabel.addEventListener('click', () => {
            this.countCheckbox.checked = !this.countCheckbox.checked;
            this.showSubnoteCounts = this.countCheckbox.checked;
            this.needsRender = true;
        });

        this.countCheckbox.addEventListener('change', (e) => {
            this.showSubnoteCounts = e.target.checked;
            this.needsRender = true;
        });

        autoUpdateLabel.addEventListener('click', () => {
            this.autoUpdateCheckbox.checked = !this.autoUpdateCheckbox.checked;
            this.autoUpdate = this.autoUpdateCheckbox.checked;
        });

        this.autoUpdateCheckbox.addEventListener('change', (e) => {
            this.autoUpdate = e.target.checked;
        });

        const canvasContainer = container.createEl('div', {
            cls: 'zettelkasten-canvas-container'
        });

        this.updateCanvasContainerSize = () => {
            const containerRect = container.getBoundingClientRect();
            const controlsRect = controlsSection.getBoundingClientRect();
            const availableHeight = containerRect.height - controlsRect.height;
            canvasContainer.style.height = Math.max(200, availableHeight) + 'px';
            canvasContainer.style.width = '100%';
        };

        this.updateCanvasContainerSize();

        this.canvas = canvasContainer.createEl('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.className = 'zettelkasten-canvas';

        this.setupMouseEvents();

        this.resizeCanvas();

        this.resizeObserver = new ResizeObserver((entries) => {
            this.updateCanvasContainerSize();
            this.resizeCanvas();
            this.needsRender = true;
        });

        this.resizeObserver.observe(container);
        this.resizeObserver.observe(canvasContainer);

        this.registerEvent(
            this.app.workspace.on('active-leaf-change', () => {
                if (this.autoUpdate) {
                    this.updateView();
                }
            })
        );

        this.startAnimationLoop();
        this.updateView();
    }

    setupMouseEvents() {
        this.canvas.addEventListener('mousemove', (e) => {
            this.updateMousePosition(e);

            if (this.isDragging) {
                this.handleDrag();
            }
        });

        this.canvas.addEventListener('mousedown', (e) => {
            this.updateMousePosition(e);
            this.dragStartPos = { ...this.mousePos };
            this.lastPanOffset = { ...this.panOffset };
            this.isDragging = true;
            this.canvas.style.cursor = 'grabbing';
        });

        this.canvas.addEventListener('mouseup', (e) => {
            if (this.isDragging) {
                const dragDistance = Math.sqrt(
                    Math.pow(this.mousePos.x - this.dragStartPos.x, 2) +
                    Math.pow(this.mousePos.y - this.dragStartPos.y, 2)
                );

                if (dragDistance < 5) {
                    this.handleNodeClick(e);
                }
            }

            this.isDragging = false;
            this.canvas.style.cursor = this.hoveredNode ? 'pointer' : 'default';
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.isDragging = false;
            this.hoveredNode = null;
            this.canvas.style.cursor = 'default';
            this.needsRender = true;
        });

        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
            this.zoom = Math.max(0.3, Math.min(3.0, this.zoom * zoomFactor));
            this.needsRender = true;
        });
    }

    updateMousePosition(e) {
        const rect = this.canvas.getBoundingClientRect();

        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        this.mousePos = {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }

    handleDrag() {
        if (!this.isDragging || !this.dragStartPos) return;

        const deltaX = this.mousePos.x - this.dragStartPos.x;
        const deltaY = this.mousePos.y - this.dragStartPos.y;

        this.panOffset.x = this.lastPanOffset.x + deltaX;
        this.panOffset.y = this.lastPanOffset.y + deltaY;

        this.needsRender = true;
    }

    startAnimationLoop() {
        const animate = () => {
            this.updateHoverState();
            this.updateNodeAnimations();

            if (this.needsRender) {
                this.renderCurrentNetwork();
                this.needsRender = false;
            }

            this.animationId = requestAnimationFrame(animate);
        };

        animate();
    }

    updateHoverState() {
        if (!this.network || this.isDragging) return;

        const prevHovered = this.hoveredNode;
        this.hoveredNode = null;

        const spacingMultiplier = this.getSpacingMultiplier();
        const centerX = this.canvas.width / 2 + this.panOffset.x;
        const centerY = this.canvas.height / 2 + this.panOffset.y;

        for (const node of this.network.nodes.values()) {
            const nodeX = centerX + (node.position.x * this.zoom * spacingMultiplier);
            const nodeY = centerY + (node.position.y * this.zoom * spacingMultiplier);
            const hoverRadius = Math.max(12, 12 * this.zoom);

            const dx = this.mousePos.x - nodeX;
            const dy = this.mousePos.y - nodeY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= hoverRadius) {
                this.hoveredNode = node;
                break;
            }
        }

        for (const node of this.network.nodes.values()) {
            const isHovered = this.hoveredNode === node;

            if (node.isCenter) {
                this.targetScales.set(node.id, 1.0);
                this.nodeScales.set(node.id, 1.0);
            } else {
                this.targetScales.set(node.id, isHovered ? 1.2 : 1.0);

                if (!this.nodeScales.has(node.id)) {
                    this.nodeScales.set(node.id, 1.0);
                }
            }

            this.targetTextOffsets.set(node.id, isHovered ? 3 : 0);

            if (!this.textOffsets.has(node.id)) {
                this.textOffsets.set(node.id, 0);
            }
        }

        if (this.hoveredNode !== prevHovered) {
            this.canvas.style.cursor = this.hoveredNode ? 'pointer' : 'default';
            this.needsRender = true;
        }
    }

    updateNodeAnimations() {
        if (!this.network) return;

        let hasAnimations = false;

        // Check if we have a center node (which is always animating with pulse)
        let hasCenterNode = false;
        for (const node of this.network.nodes.values()) {
            if (node.isCenter) {
                hasCenterNode = true;
                break;
            }
        }

        for (const node of this.network.nodes.values()) {
            if (!node.isCenter) {
                const currentScale = this.nodeScales.get(node.id) || 1.0;
                const targetScale = this.targetScales.get(node.id) || 1.0;

                const scaleDiff = targetScale - currentScale;
                if (Math.abs(scaleDiff) > 0.001) {
                    const newScale = currentScale + (scaleDiff * this.animationSpeed);
                    this.nodeScales.set(node.id, newScale);
                    hasAnimations = true;
                } else {
                    this.nodeScales.set(node.id, targetScale);
                }
            }

            const currentOffset = this.textOffsets.get(node.id) || 0;
            const targetOffset = this.targetTextOffsets.get(node.id) || 0;

            const offsetDiff = targetOffset - currentOffset;
            if (Math.abs(offsetDiff) > 0.01) {
                const newOffset = currentOffset + (offsetDiff * this.animationSpeed);
                this.textOffsets.set(node.id, newOffset);
                hasAnimations = true;
            } else {
                this.textOffsets.set(node.id, targetOffset);
            }
        }

        // Always render if we have a center node (for pulsing glow) or other animations
        if (hasAnimations || hasCenterNode) {
            this.needsRender = true;
        }
    }

    getSpacingMultiplier() {
        return this.forceSlider ? parseInt(this.forceSlider.value) / 100 : 1;
    }

    // Helper function to convert hex colors to RGB for gradient effects
    hexToRgb(hex) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return { r, g, b };
    }



    handleNodeClick(event) {
        if (!this.hoveredNode) return;

        const file = this.plugin.getZettelNotes().get(this.hoveredNode.id);
        if (file) {
            if (event && (event.ctrlKey || event.metaKey)) {
                // Ctrl/Cmd+click: open in new tab
                this.app.workspace.getLeaf('tab').openFile(file);
            } else {
                // Regular click: open in current active tab
                const activeLeaf = this.app.workspace.getActiveViewOfType(require('obsidian').MarkdownView)?.leaf ||
                    this.app.workspace.getMostRecentLeaf();

                if (activeLeaf) {
                    activeLeaf.openFile(file);
                } else {
                    // Fallback: if no active leaf found, create new one
                    this.app.workspace.getLeaf(true).openFile(file);
                }

                // If auto-update is enabled, update the graph immediately
                if (this.autoUpdate) {
                    // Small delay to ensure the file change is processed
                    setTimeout(() => {
                        this.updateView();
                    }, 50);
                }
            }
        }
    }

    resizeCanvas() {
        if (!this.canvas || !this.canvas.parentElement) return;

        const container = this.canvas.parentElement;
        const rect = container.getBoundingClientRect();

        const newWidth = Math.max(200, Math.floor(rect.width));
        const newHeight = Math.max(150, Math.floor(rect.height));

        if (this.canvas.width !== newWidth || this.canvas.height !== newHeight) {
            this.canvas.width = newWidth;
            this.canvas.height = newHeight;
            this.needsRender = true;
        }
    }

    updateView() {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) return;

        const zettelId = this.plugin.parseZettelId(activeFile.basename);
        if (!zettelId) {
            this.renderEmpty();
            return;
        }

        this.network = this.plugin.buildZettelNetwork(zettelId, this.currentDepth, this.currentMaxBranches);

        this.nodeScales.clear();
        this.targetScales.clear();
        this.textOffsets.clear();
        this.targetTextOffsets.clear();

        this.panOffset = { x: 0, y: 0 };

        this.needsRender = true;
    }

    renderCurrentNetwork() {
        if (this.network) {
            this.renderNetwork(this.network);
        } else {
            this.renderEmpty();
        }
    }

    renderEmpty() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = '#333333';
        this.ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Current note is not a Zettelkasten note', this.canvas.width / 2, this.canvas.height / 2);
    }

    renderNetwork(network) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const centerX = this.canvas.width / 2 + this.panOffset.x;
        const centerY = this.canvas.height / 2 + this.panOffset.y;
        const spacingMultiplier = this.getSpacingMultiplier();

        network.edges.forEach(edge => {
            const fromNode = network.nodes.get(edge.from);
            const toNode = network.nodes.get(edge.to);

            if (fromNode && toNode) {
                const fromX = centerX + (fromNode.position.x * this.zoom * spacingMultiplier);
                const fromY = centerY + (fromNode.position.y * this.zoom * spacingMultiplier);
                const toX = centerX + (toNode.position.x * this.zoom * spacingMultiplier);
                const toY = centerY + (toNode.position.y * this.zoom * spacingMultiplier);

                this.ctx.beginPath();
                this.ctx.strokeStyle = '#CCCCCC';
                this.ctx.lineWidth = 1;

                if (edge.type === 'linear-continuation') {
                    this.ctx.setLineDash([3, 3]);
                } else {
                    this.ctx.setLineDash([]);
                }

                this.ctx.moveTo(fromX, fromY);
                this.ctx.lineTo(toX, toY);
                this.ctx.stroke();
            }
        });

        this.ctx.setLineDash([]);

        network.nodes.forEach(node => {
            this.drawNode(node, centerX, centerY, spacingMultiplier);
        });

        network.nodes.forEach(node => {
            this.drawSubnoteCount(node, centerX, centerY, spacingMultiplier);
        });

        network.nodes.forEach(node => {
            this.drawLabel(node, centerX, centerY, spacingMultiplier);
        });
    }

    drawNode(node, centerX, centerY, spacingMultiplier) {
        const x = centerX + (node.position.x * this.zoom * spacingMultiplier);
        const y = centerY + (node.position.y * this.zoom * spacingMultiplier);

        // Calculate base radius
        let baseRadius = Math.max(4, 8 * this.zoom);

        // Apply size scaling based on depth for multiple node types
        if ((node.level === 1 || node.level === -1 || node.level === -2 || node.level === 0) && node.depthScore !== undefined) {
            const sizeMultiplier = 1.0 + (node.depthScore * 1.5);
            baseRadius = baseRadius * sizeMultiplier;
        }

        let radius = baseRadius;

        // Apply hover scaling (but not for center node and not conflicting with depth scaling)
        if (!node.isCenter && ![1, -2, 0].includes(node.level)) {
            const scale = this.nodeScales.get(node.id) || 1.0;
            radius = baseRadius * scale;
        } else if (!node.isCenter && [1, -2, 0].includes(node.level)) {
            // For depth-scaled nodes, apply hover scaling on top of depth scaling
            const hoverScale = this.nodeScales.get(node.id) || 1.0;
            radius = baseRadius * hoverScale;
        }

        let fillColor;

        if (node.isCenter) {
            fillColor = '#4F8EDB';
        } else {
            switch (node.level) {
                case -4:
                    fillColor = '#7B9FA3';
                    break;
                case -3:
                    fillColor = '#6B9BD1';
                    break;
                case -2:
                    fillColor = '#8B7EC8';
                    break;
                case -1:
                    fillColor = '#9FABB8';
                    break;
                case 0:
                    fillColor = '#7BA3A0';
                    break;
                case 1:
                    fillColor = '#C4A484';
                    break;
                default:
                    fillColor = '#95A5A6';
            }
        }

        if (this.hoveredNode === node) {
            // Create hover effect by brightening the color
            fillColor = fillColor === '#4F8EDB' ? '#6FAEFB' : 
                        fillColor === '#7B9FA3' ? '#9BBFC3' :
                        fillColor === '#6B9BD1' ? '#8BBBF1' :
                        fillColor === '#8B7EC8' ? '#AB9EE8' :
                        fillColor === '#9FABB8' ? '#BFCBD8' :
                        fillColor === '#7BA3A0' ? '#9BC3C0' :
                        fillColor === '#C4A484' ? '#E4C4A4' : '#B0C0D0';
        }

        // Draw glow effects and the main node
        if (node.isCenter) {
            // CENTER NODE: Square with pulsing glow
            const currentTime = Date.now();
            const animationTime = (currentTime - this.animationStartTime) / 1000; // Convert to seconds
            const pulseIntensity = (Math.sin(animationTime * 2) + 1) / 2; // 0 to 1, pulses twice per second

            const squareSize = radius * 3.0; // Much bigger center node (3x instead of 1.4x)
            const glowSize = squareSize + (pulseIntensity * 4) + 3; // Smaller, more subtle glow

            // Draw multiple glow layers for stronger effect
            const baseGlowOpacity = 0.05 + (pulseIntensity * 0.05); // Much more subtle glow opacity
            const rgb = this.hexToRgb(fillColor);

            // Outer glow layer
            const outerGradient = this.ctx.createRadialGradient(x, y, squareSize * 0.7, x, y, glowSize);
            outerGradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${baseGlowOpacity})`);
            outerGradient.addColorStop(0.5, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${baseGlowOpacity * 0.5})`);
            outerGradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);

            this.ctx.beginPath();
            this.ctx.arc(x, y, glowSize, 0, 2 * Math.PI);
            this.ctx.fillStyle = outerGradient;
            this.ctx.fill();

            // Inner glow layer for more intensity
            const innerGradient = this.ctx.createRadialGradient(x, y, squareSize * 0.5, x, y, squareSize);
            innerGradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${baseGlowOpacity * 0.8})`);
            innerGradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);

            this.ctx.beginPath();
            this.ctx.arc(x, y, squareSize, 0, 2 * Math.PI);
            this.ctx.fillStyle = innerGradient;
            this.ctx.fill();

            // Draw the square with shadow
            this.ctx.shadowColor = fillColor;
            this.ctx.shadowBlur = 2 + (pulseIntensity * 2); // Reduced shadow blur
            this.ctx.shadowOffsetX = 0;
            this.ctx.shadowOffsetY = 0;

            this.ctx.beginPath();
            this.ctx.rect(x - squareSize / 2, y - squareSize / 2, squareSize, squareSize);
            this.ctx.fillStyle = fillColor;
            this.ctx.fill();

            // Reset shadow
            this.ctx.shadowColor = 'transparent';
            this.ctx.shadowBlur = 0;

        } else {
            // REGULAR NODES: Circles with subtle glow
            const subtleGlowSize = radius + 2; // Smaller glow radius (2px instead of 4px)
            const rgb = this.hexToRgb(fillColor);

            // Draw subtle glow effect
            const subtleGradient = this.ctx.createRadialGradient(x, y, radius * 0.9, x, y, subtleGlowSize);
            subtleGradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.04)`); // Even more subtle opacity
            subtleGradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);

            this.ctx.beginPath();
            this.ctx.arc(x, y, subtleGlowSize, 0, 2 * Math.PI);
            this.ctx.fillStyle = subtleGradient;
            this.ctx.fill();

            // Draw the main circle
            this.ctx.beginPath();
            this.ctx.arc(x, y, radius, 0, 2 * Math.PI);
            this.ctx.fillStyle = fillColor;
            this.ctx.fill();

            // Add a subtle border for nodes with significant content
            if ([1, -2, 0].includes(node.level) && node.depthScore !== undefined && node.depthScore > 0.3) {
                this.ctx.beginPath();
                this.ctx.arc(x, y, radius, 0, 2 * Math.PI);
                this.ctx.strokeStyle = '#444444';
                this.ctx.lineWidth = Math.max(0.5, 1 * this.zoom);
                this.ctx.stroke();
            }
        }
    }

    drawLabel(node, centerX, centerY, spacingMultiplier) {
        const x = centerX + (node.position.x * this.zoom * spacingMultiplier);
        const nodeY = centerY + (node.position.y * this.zoom * spacingMultiplier);

        // Calculate the actual node radius (same logic as in drawNode)
        let baseRadius = Math.max(4, 8 * this.zoom);

        // Apply size scaling based on depth for multiple node types
        if ((node.level === 1 || node.level === -1 || node.level === -2 || node.level === 0) && node.depthScore !== undefined) {
            const sizeMultiplier = 1.0 + (node.depthScore * 1.5);
            baseRadius = baseRadius * sizeMultiplier;
        }

        let actualRadius = baseRadius;

        // Apply hover scaling
        if (!node.isCenter && ![1, -1, -2, 0].includes(node.level)) {
            const scale = this.nodeScales.get(node.id) || 1.0;
            actualRadius = baseRadius * scale;
        } else if (!node.isCenter && [1, -1, -2, 0].includes(node.level)) {
            const hoverScale = this.nodeScales.get(node.id) || 1.0;
            actualRadius = baseRadius * hoverScale;
        }

        // For center nodes, account for the larger square size and glow
        if (node.isCenter) {
            actualRadius = baseRadius * 3.0; // Much larger square size multiplier
        }

        // Position text below the actual node size with extra padding for center nodes  
        const textPadding = node.isCenter 
            ? Math.max(8, 12 * this.zoom) // Closer text for center node
            : Math.max(6, 9 * this.zoom);   // Regular padding for other nodes
        const baseY = nodeY + actualRadius + textPadding;

        const textOffset = this.textOffsets.get(node.id) || 0;
        const y = baseY + textOffset;

        let baseOpacity = Math.max(0, Math.min(1, (this.zoom - 0.3) / 0.5));

        if (this.hoveredNode === node) {
            baseOpacity = Math.max(baseOpacity, 0.9);
        }

        if (baseOpacity > 0.05) {
            this.ctx.save();

            const textColor = '#333333';
            const rgb = textColor === '#ffffff' ? '255, 255, 255' : '44, 44, 44';
            this.ctx.fillStyle = `rgba(${rgb}, ${baseOpacity})`;

            const fontSize = Math.max(8, 11 * this.zoom);
            const fontWeight = this.hoveredNode === node ? 'bold' : 'normal';
            this.ctx.font = `${fontWeight} ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'alphabetic';

            const adjustedY = y + (fontSize * 0.3);

            this.ctx.fillText(node.id, x, adjustedY);

            this.ctx.restore();
        }
    }

    drawSubnoteCount(node, centerX, centerY, spacingMultiplier) {
        // Only show counts for nodes that have depth scores and if enabled
        if (!this.showSubnoteCounts || node.subnotesCount === undefined) return;

        const x = centerX + (node.position.x * this.zoom * spacingMultiplier);
        const y = centerY + (node.position.y * this.zoom * spacingMultiplier);

        // Calculate the same radius as drawNode
        let baseRadius = Math.max(4, 8 * this.zoom);

        // Apply size scaling
        if ((node.level === 1 || node.level === -1 || node.level === -2 || node.level === 0) && node.depthScore !== undefined) {
            const sizeMultiplier = 1.0 + (node.depthScore * 1.5);
            baseRadius = baseRadius * sizeMultiplier;
        }

        let actualRadius = baseRadius;

        // Apply hover scaling
        if (!node.isCenter && ![1, -1, -2, 0].includes(node.level)) {
            const scale = this.nodeScales.get(node.id) || 1.0;
            actualRadius = baseRadius * scale;
        } else if (!node.isCenter && [1, -1, -2, 0].includes(node.level)) {
            const hoverScale = this.nodeScales.get(node.id) || 1.0;
            actualRadius = baseRadius * hoverScale;
        }

        // Only show count if node is big enough
        if (actualRadius < 12) {
            return;
        }

        // Calculate appropriate font size based on node size
        const fontSize = Math.max(8, Math.min(actualRadius * 0.6, 16));

        this.ctx.save();

        // Set font
        this.ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        // Use contrasting text color
        this.ctx.fillStyle = 'white';
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        this.ctx.lineWidth = 1;

        const countText = String(node.subnotesCount);

        // Draw text with outline for better visibility
        this.ctx.strokeText(countText, x, y);
        this.ctx.fillText(countText, x, y);

        this.ctx.restore();
    }

    async onClose() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
    }
}

class ZettelkastenSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName('Default maximum depth')
            .setDesc('Default number of levels deep to show in the branch view')
            .addText(text => text
                .setPlaceholder('2')
                .setValue(String(this.plugin.settings.showDepth))
                .onChange(async (value) => {
                    this.plugin.settings.showDepth = parseInt(value) || 2;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Default maximum branches')
            .setDesc('Default maximum number of branches to show per level')
            .addText(text => text
                .setPlaceholder('5')
                .setValue(String(this.plugin.settings.maxBranches))
                .onChange(async (value) => {
                    this.plugin.settings.maxBranches = parseInt(value) || 5;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Horizontal spacing')
            .setDesc('Spacing between linear sequence nodes')
            .addText(text => text
                .setPlaceholder('150')
                .setValue(String(this.plugin.settings.horizontalSpacing))
                .onChange(async (value) => {
                    this.plugin.settings.horizontalSpacing = parseInt(value) || 150;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Vertical spacing')
            .setDesc('Spacing between fork nodes')
            .addText(text => text
                .setPlaceholder('100')
                .setValue(String(this.plugin.settings.verticalSpacing))
                .onChange(async (value) => {
                    this.plugin.settings.verticalSpacing = parseInt(value) || 100;
                    await this.plugin.saveSettings();
                }));
    }
}

module.exports = ZettelkastenBranchTracker;