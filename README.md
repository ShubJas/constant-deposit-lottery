# constant-deposit-lottery #

A Solidity implementation of a constant-deposit lottery.

### Requirements ###

* npm

### Installation ###

Clone the repository and install the dependencies via `npm`.

```
npm install
```

In order to create an exacutable, execute

```
sudo npm install -g
```

To uninstall it, execute
```
sudo npm uninstall -g 
```

If you don't want to trust me, you can execute `index.js`.


### Execution ###

Create a new lottery executing
```
lottery start
```

It will ask how many level to use, and for the deposit amount.

Start a new player by typing
```
lottery player
```

It will ask how many level to use, for an id (use a number between 0-3), and for the lottery address.
The secrets (one for each level) are generated randomly.
