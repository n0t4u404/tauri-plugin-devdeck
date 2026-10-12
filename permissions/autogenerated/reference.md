## Default Permission

Allows the app to open the devdeck window.

Add it to the capability of the window that calls `startDevdeck()` or `openDevdeck()`.
devdeck is a development tool: register the plugin only in debug builds, under `#[cfg(debug_assertions)]`.

#### This default permission set includes the following:

- `allow-open`

## Permission Table

<table>
<tr>
<th>Identifier</th>
<th>Description</th>
</tr>


<tr>
<td>

`devdeck:allow-open`

</td>
<td>

Enables the open command without any pre-configured scope.

</td>
</tr>

<tr>
<td>

`devdeck:deny-open`

</td>
<td>

Denies the open command without any pre-configured scope.

</td>
</tr>
</table>
